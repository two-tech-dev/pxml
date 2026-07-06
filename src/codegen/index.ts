import Anthropic from '@anthropic-ai/sdk';
import { Node } from '../parser/schema.js';
import { FileWriter } from '../writer/index.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface AIProvider {
  generate(prompt: string, systemPrompt: string, model: string): Promise<string>;
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(prompt: string, systemPrompt: string, model: string): Promise<string> {
    const response = await this.client.messages.create({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}

export class OpenAICompatibleProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, systemPrompt: string, model: string): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            stream: false
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI Provider HTTP error! status: ${response.status}, details: ${errText}`);
        }

        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (attempt >= maxRetries) {
          throw new Error(`OpenAI API request failed after ${maxRetries} attempts: ${err.message}`);
        }
        console.warn(`[API WARN] Attempt ${attempt} failed: ${err.message}. Retrying...`);
        // Backoff delay
        await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    throw new Error('OpenAI API request failed.');
  }
}

export class OllamaProvider implements AIProvider {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, systemPrompt: string, model: string): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

      try {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            prompt: `${systemPrompt}\n\nUser specifications:\n${prompt}`,
            stream: false,
            options: {
              temperature: 0.2
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama Provider HTTP error! status: ${response.status}, details: ${errText}`);
        }

        const data = await response.json() as any;
        return data.response || '';
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (attempt >= maxRetries) {
          throw new Error(`Ollama API request failed after ${maxRetries} attempts: ${err.message}`);
        }
        console.warn(`[OLLAMA WARN] Attempt ${attempt} failed: ${err.message}. Retrying...`);
        await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    throw new Error('Ollama API request failed.');
  }
}

export interface CodegenConfig {
  provider?: 'anthropic' | 'openai' | 'ollama' | 'custom';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  customProvider?: AIProvider;
  mockResponse?: (node: Node) => string;
}

export class PxmlCodegen {
  private config: CodegenConfig;
  private provider?: AIProvider;

  constructor(config: CodegenConfig) {
    this.config = config;

    if (config.mockResponse) {
      return;
    }

    if (config.customProvider) {
      this.provider = config.customProvider;
    } else if (config.provider === 'openai') {
      if (!config.apiKey) throw new Error('API Key required for OpenAI provider');
      this.provider = new OpenAICompatibleProvider(config.apiKey, config.baseUrl);
    } else if (config.provider === 'ollama') {
      this.provider = new OllamaProvider(config.baseUrl);
    } else {
      // Default to anthropic
      if (!config.apiKey) throw new Error('API Key required for Anthropic provider');
      this.provider = new AnthropicProvider(config.apiKey);
    }
  }

  async generateNodeCode(node: Node, projectContext: string, writer: FileWriter): Promise<string> {
    if (node.type === 'setup-command') {
      if (this.config.mockResponse) {
        const mockCmd = this.config.mockResponse(node);
        console.log(`[SETUP-COMMAND] Would execute: ${mockCmd}`);
        return mockCmd;
      }

      if (!this.provider) {
        throw new Error(`AI Provider is not configured.`);
      }

      const prompt = `Project Context:
${projectContext}

Generate the exact terminal shell command to initialize/configure this project:
- ID: ${node.id}
- Type: ${node.type}
- Flow: ${node.flow}
- Target: Run setup tasks like 'npx create-next-app ...' or 'npm install ...'
- Constraints:
${node.constraints.map(c => `  - [${c.verify}] ${c.description}`).join('\n')}

Generate ONLY the single-line shell command. Do not include explanation, comment, or markdown block wrapping.`;

      const systemPrompt = `You are a DevOps engineer generating setup shell commands. Generate ONLY the executable terminal command text. Do not wrap in markdown or backticks.`;
      const commandText = (await this.provider.generate(prompt, systemPrompt, this.config.model)).trim();
      
      console.log(`[SETUP-COMMAND] Executing command: "${commandText}"`);

      // Conflict avoidance workaround for npx create-next-app .
      const isCreateNextApp = commandText.includes('create-next-app');
      const tempDir = path.join(process.cwd(), '../.pxml-temp-init');
      const conflictItems = ['project.xml', 'pxml.xsd', 'flows', 'shared', '.pxml'];
      const movedItems: { src: string; dest: string }[] = [];

      if (isCreateNextApp) {
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        for (const item of conflictItems) {
          const itemPath = path.join(process.cwd(), item);
          if (fs.existsSync(itemPath)) {
            const destPath = path.join(tempDir, item);
            if (fs.existsSync(destPath)) {
              fs.rmSync(destPath, { recursive: true, force: true });
            }
            fs.renameSync(itemPath, destPath);
            movedItems.push({ src: destPath, dest: itemPath });
          }
        }
      }

      try {
        execSync(commandText, { stdio: 'inherit', cwd: process.cwd() });
      } finally {
        // Restore moved files
        if (isCreateNextApp) {
          for (const item of movedItems) {
            if (fs.existsSync(item.src)) {
              fs.renameSync(item.src, item.dest);
            }
          }
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }

      return commandText;
    }

    if (this.config.mockResponse) {
      const mockCode = this.config.mockResponse(node);
      writer.write(node.meta.path, mockCode);
      this.logAIResponse(node.id, "MOCK PROMPT", mockCode);
      return mockCode;
    }

    if (!this.provider) {
      throw new Error(`AI Provider is not configured.`);
    }

    const prompt = this.buildPrompt(node, projectContext);
    const systemPrompt = `You are an expert software engineer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax (like \`\`\`typescript) or explanations. Only output code.`;
    
    const code = await this.provider.generate(prompt, systemPrompt, this.config.model);
    const cleanedCode = this.cleanMarkdown(code);

    writer.write(node.meta.path, cleanedCode);
    this.logAIResponse(node.id, prompt, cleanedCode);
    return cleanedCode;
  }

  private buildPrompt(node: Node, projectContext: string): string {
    return `Project Context:
${projectContext}

Generate implementation file for this node:
- ID: ${node.id}
- Type: ${node.type}
- Flow: ${node.flow}
- Destination Path: ${node.meta.path}
- Input Fields: ${JSON.stringify(node.input)}
- Output Fields: ${JSON.stringify(node.output)}
- Constraints:
${node.constraints.map(c => `  - [${c.verify}] ${c.description}`).join('\n')}

Generate the cleanest code matching this specification. Do not include markdown wrapping or explanation.`;
  }

  private cleanMarkdown(code: string): string {
    let cleaned = code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    // Remove any trailing AI skipped pattern comment or annotation
    cleaned = cleaned.replace(/\s*→\s*skipped:.*$/gm, '');
    cleaned = cleaned.replace(/\s*\/\/\s*skipped:.*$/gm, '');
    return cleaned.trim();
  }

  private logAIResponse(nodeId: string, prompt: string, response: string) {
    const logsDir = path.resolve('.pxml', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const safeNodeId = nodeId.replace(/:/g, '_');
    const logPath = path.join(logsDir, `${safeNodeId}.log`);
    const logContent = `--- PROMPT ---\n${prompt}\n\n--- RESPONSE ---\n${response}\n`;
    fs.writeFileSync(logPath, logContent, 'utf-8');
  }
}
