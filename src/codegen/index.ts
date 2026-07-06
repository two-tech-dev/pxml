import Anthropic from '@anthropic-ai/sdk';
import { Node } from '../parser/schema.js';
import { FileWriter } from '../writer/index.js';
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
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Provider HTTP error! status: ${response.status}, details: ${errText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }
}

export class OllamaProvider implements AIProvider {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, systemPrompt: string, model: string): Promise<string> {
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
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Provider HTTP error! status: ${response.status}, details: ${errText}`);
    }

    const data = await response.json() as any;
    return data.response || '';
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
    return code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
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
