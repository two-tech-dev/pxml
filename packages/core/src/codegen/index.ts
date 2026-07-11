import Anthropic from '@anthropic-ai/sdk';
import { Node } from '../parser/schema.js';
import { FileWriter } from '../writer/index.js';
import { getTestFilePath } from '../runner/index.js';
import { PxmlPatcher } from '../patcher/index.js';
import { validateNode } from '../validator/index.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  getStackInstructions,
  getImportRules,
  codegenUserPrompt,
  setupCommandUserPrompt,
  SETUP_COMMAND_SYSTEM,
  verifyUserPrompt,
  VERIFY_SYSTEM,
  validateFixPrompt,
  VALIDATE_FIX_SYSTEM,
  fixLoopPrompt,
  FIX_LOOP_SYSTEM,
  buildFixPrompt,
  BUILD_FIX_SYSTEM,
  TEST_SYSTEM,
  newTestPrompt,
  updateTestPrompt,
  combinedTestPrompt,
  COMBINED_TEST_SYSTEM,
} from '@two-tech-dev/pxml-prompts';

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`
};

export const IMPORT_RULES = getImportRules('nextjs');

// ── Token budget ──────────────────────────────────────────────────
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
const TOKEN_WARN = 6000;

// ── Retry helper: skip 4xx (permanent), retry 5xx + network ──────
function isRetryable(err: any): boolean {
  const msg = String(err.message || err);
  if (msg.includes('status: 40') || msg.includes('status: 41') ||
      msg.includes('status: 42') || msg.includes('status: 43')) return false;
  if (msg.includes('status: 4') && !msg.includes('status: 429')) return false;
  return true;
}

function buildPromptSummary(label: string, prompt: string, systemPrompt: string) {
  const pt = estimateTokens(prompt);
  const st = estimateTokens(systemPrompt);
  const total = pt + st;
  if (total > TOKEN_WARN) {
    console.warn(`${colors.yellow('[TOKEN]')} ${label}: ~${total} tokens (prompt ${pt} + system ${st})`);
  }
  return total;
}

// ── Prompts override ──────────────────────────────────────────────
const _overrideCache = new Map<string, string | null>();

function resolvePromptOverride(cwd: string, key: string, fallback: string): string {
  const cacheKey = `${cwd}:${key}`;
  if (_overrideCache.has(cacheKey)) return _overrideCache.get(cacheKey)!;
  const file = path.join(cwd, '.pxml', 'prompts', `${key}.txt`);
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8').trim();
    if (content) {
      console.log(`${colors.cyan('[PROMPTS]')} Using override: .pxml/prompts/${key}.txt`);
      _overrideCache.set(cacheKey, content);
      return content;
    }
  }
  _overrideCache.set(cacheKey, fallback);
  return fallback;
}

// ── AIProvider ────────────────────────────────────────────────────
export interface AIProvider {
  generate(prompt: string, systemPrompt: string, model: string, images?: string[], temperature?: number): Promise<string>;
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  public stats = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  private maxRetries: number;
  constructor(apiKey: string, maxRetries = 3) {
    this.client = new Anthropic({ apiKey });
    this.maxRetries = maxRetries;
  }

  async generate(prompt: string, systemPrompt: string, model: string, images: string[] = [], temperature = 0.2): Promise<string> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      attempt++;
      try {
        const content: any[] = [{ type: 'text', text: prompt }];
        for (const img of images) {
          const mime = img.match(/^data:(image\/\w+);/)?.[1] || 'image/png';
          const base64 = img.includes('base64,') ? img.split('base64,')[1] : img;
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: mime, data: base64 }
          });
        }
        const response = await this.client.messages.create({
          model,
          max_tokens: 8192,
          temperature,
          system: [
            { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }
          ],
          messages: [{ role: 'user', content }]
        });
        if (response.usage) {
          this.stats.inputTokens += response.usage.input_tokens || 0;
          this.stats.outputTokens += response.usage.output_tokens || 0;
          const cacheRead = (response.usage as any).cache_read_input_tokens || 0;
          this.stats.cachedTokens += cacheRead;
        }
        return response.content[0].type === 'text' ? response.content[0].text : '';
      } catch (err: any) {
        if (!isRetryable(err) || attempt >= this.maxRetries) {
          throw new Error(`Anthropic API request failed after ${attempt} attempt(s): ${err.message}`);
        }
        console.warn(`[ANTHROPIC WARN] Attempt ${attempt} failed: ${err.message}. Retrying...`);
        await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    throw new Error('Anthropic API request failed.');
  }
}

export class OpenAICompatibleProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;
  public stats = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, systemPrompt: string, model: string, images: string[] = [], temperature = 0.2): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Number(process.env.PXML_API_TIMEOUT_MS) || 90000);

      try {
        const userContent: any[] = [{ type: 'text', text: prompt }];
        for (const img of images) {
          userContent.push({ type: 'image_url', image_url: { url: img } });
        }
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
              { role: 'user', content: images.length > 0 ? userContent : prompt }
            ],
            temperature,
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
        if (data.usage) {
          this.stats.inputTokens += data.usage.prompt_tokens || 0;
          this.stats.outputTokens += data.usage.completion_tokens || 0;
          const cached = data.usage.prompt_tokens_details?.cached_tokens || 0;
          this.stats.cachedTokens += cached;
        }
        return data.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (!isRetryable(err) || attempt >= maxRetries) {
          throw new Error(`OpenAI API request failed after ${attempt} attempt(s): ${err.message}`);
        }
        console.warn(`[API WARN] Attempt ${attempt} failed: ${err.message}. Retrying...`);
        await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    throw new Error('OpenAI API request failed.');
  }
}

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  public stats = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, systemPrompt: string, model: string, images: string[] = [], temperature = 0.2): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Number(process.env.PXML_API_TIMEOUT_MS) || 90000);

      try {
        const body: any = {
          model,
          prompt: `${systemPrompt}\n\nUser specifications:\n${prompt}`,
          stream: false,
          options: { temperature }
        };
        if (images.length > 0) {
          body.images = images.map(img => img.split('base64,')[1] || img);
        }
        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama Provider HTTP error! status: ${response.status}, details: ${errText}`);
        }

        const data = await response.json() as any;
        if (data) {
          this.stats.inputTokens += data.prompt_eval_count || 0;
          this.stats.outputTokens += data.eval_count || 0;
        }
        return data.response || '';
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (!isRetryable(err) || attempt >= maxRetries) {
          throw new Error(`Ollama API request failed after ${attempt} attempt(s): ${err.message}`);
        }
        console.warn(`[OLLAMA WARN] Attempt ${attempt} failed: ${err.message}. Retrying...`);
        await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    throw new Error('Ollama API request failed.');
  }
}

// ── CodegenConfig ──────────────────────────────────────────────────
export interface CodegenConfig {
  provider?: 'anthropic' | 'openai' | 'ollama' | 'custom';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  customProvider?: AIProvider;
  mockResponse?: (node: Node) => string;
  skipVerification?: boolean;
  skipValidation?: boolean;
  cwd?: string;
}

export class PxmlCodegen {
  private config: CodegenConfig;
  private provider?: AIProvider;

  constructor(config: CodegenConfig) {
    this.config = config;
    if (config.mockResponse) return;

    if (config.customProvider) {
      this.provider = config.customProvider;
    } else if (config.provider === 'openai') {
      if (!config.apiKey) throw new Error('API Key required for OpenAI provider');
      this.provider = new OpenAICompatibleProvider(config.apiKey, config.baseUrl);
    } else if (config.provider === 'ollama') {
      this.provider = new OllamaProvider(config.baseUrl);
    } else {
      if (!config.apiKey) throw new Error('API Key required for Anthropic provider');
      this.provider = new AnthropicProvider(config.apiKey);
    }
  }

  getStats() {
    if (this.provider && 'stats' in this.provider) {
      return (this.provider as any).stats;
    }
    return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  }

  async generateDirect(prompt: string, systemPrompt: string, images: string[] = [], temperature = 0.1): Promise<string> {
    if (!this.provider) throw new Error(`AI Provider is not configured.`);
    return this.provider.generate(prompt, systemPrompt, this.config.model, images, temperature);
  }

  async generateNodeCode(
    node: Node,
    projectContext: string,
    writer: FileWriter,
    stack = 'nextjs',
    cwd = process.cwd()
  ): Promise<string> {
    const stackInfo = getStackInstructions(stack);
    const importRules = getImportRules(stack);
    const cwdDir = this.config.cwd || cwd;

    if (node.type === 'setup-command') {
      if (this.config.mockResponse) {
        const mockCmd = this.config.mockResponse(node);
        console.log(`${colors.cyan(colors.bold('[SETUP-COMMAND]'))} Would execute: ${mockCmd}`);
        return mockCmd;
      }
      if (!this.provider) throw new Error(`AI Provider is not configured.`);

      const prompt = setupCommandUserPrompt({
        projectContext,
        id: node.id,
        type: node.type,
        flow: node.flow,
        stack,
        constraints: node.constraints,
      });

      const commandText = (await this.provider.generate(prompt, SETUP_COMMAND_SYSTEM, this.config.model)).trim();
      console.log(`${colors.cyan(colors.bold('[SETUP-COMMAND]'))} Executing command: "${commandText}"`);

      const isCreateNextApp = commandText.includes('create-next-app');
      const tempDir = path.join(process.cwd(), '../.pxml-temp-init');
      const conflictItems = ['project.xml', 'pxml.xsd', 'pxml.json', 'flows', 'shared', 'packages', '.pxml', 'components', 'README.md', 'LICENSE', '.gitignore', 'bugs_history.xml', 'bugs.xsd', 'AGENTS.md', 'CLAUDE.md'];
      const movedItems: { src: string; dest: string }[] = [];

      if (isCreateNextApp) {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        for (const item of conflictItems) {
          const itemPath = path.join(process.cwd(), item);
          if (fs.existsSync(itemPath)) {
            const destPath = path.join(tempDir, item);
            if (fs.existsSync(destPath)) fs.rmSync(destPath, { recursive: true, force: true });
            fs.renameSync(itemPath, destPath);
            movedItems.push({ src: destPath, dest: itemPath });
          }
        }
      }

      try {
        execSync(commandText, { stdio: 'inherit', cwd: process.cwd() });
      } finally {
        if (isCreateNextApp) {
          for (const item of movedItems) {
            if (fs.existsSync(item.src)) fs.renameSync(item.src, item.dest);
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

    if (!this.provider) throw new Error(`AI Provider is not configured.`);

    const prompt = this.buildPrompt(node, projectContext, stackInfo.promptNote);
    const systemPrompt = resolveSystemPrompt(cwdDir, 'codegen', stackInfo.systemPrompt + '\n' + importRules);
    buildPromptSummary(`[GEN] ${node.id}`, prompt, systemPrompt);

    const code = await this.provider.generate(prompt, systemPrompt, this.config.model, (node as any).images || [], 0.2);
    let cleanedCode = this.tryStructuredExtract(code);

    if (!this.config.skipVerification) {
      try {
        const vPrompt = verifyUserPrompt({
          nodeId: node.id,
          path: node.meta.path,
          constraints: node.constraints,
          code: cleanedCode,
        });
        const verSys = resolvePromptOverride(cwdDir, 'verify', VERIFY_SYSTEM);
        const vResp = await this.provider.generate(vPrompt, verSys, this.config.model, [], 0.1);
        const vClean = this.cleanMarkdown(vResp);
        if (vClean.toUpperCase() !== 'STABLE' && vClean.length > 20) {
          console.log(`${colors.green(colors.bold('[VERIFY]'))} AI self-corrected generated code for node: ${node.id}`);
          cleanedCode = vClean;
        }
      } catch (err: any) {
        console.warn(`[VERIFY WARNING] Self-verification step skipped: ${err.message}`);
      }
    }

    this.finalizeWrite(node, writer, cleanedCode, prompt);

    if (!this.config.skipValidation && node.meta.path && node.type !== 'setup-command') {
      const maxV = 3;
      for (let attempt = 1; attempt <= maxV; attempt++) {
        const vres = validateNode(node, cwd, stack);
        if (vres.ok) break;

        if (attempt === 1) {
          console.log(`${colors.yellow(colors.bold('[VALIDATE]'))} Node ${node.id} has syntax/type errors, auto-fixing...`);
        }

        const absPath = path.resolve(cwd, node.meta.path);
        const cur = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : cleanedCode;
        const fPrompt = validateFixPrompt({
          path: node.meta.path,
          errors: vres.errors,
          currentCode: cur,
          importRules,
        });

        try {
          const valSys = resolvePromptOverride(cwdDir, 'validate-fix', VALIDATE_FIX_SYSTEM);
          const patch = await this.generateDirect(fPrompt, valSys, [], 0.1);
          if (patch.trim().toUpperCase() === 'NODEP') {
            console.log(`${colors.yellow('[VALIDATE]')} Node ${node.id}: dependency error detected, skipping code fix.`);
            break;
          }
          const patched = PxmlPatcher.applyPatch(cur, patch);
          writer.write(absPath, patched);
          console.log(`${colors.green(colors.bold('[VALIDATE]'))} Applied fix to ${node.meta.path} (attempt ${attempt}).`);
        } catch (err: any) {
          console.warn(`${colors.red('[VALIDATE]')} fix attempt ${attempt} failed: ${err.message}`);
          break;
        }
      }
    }

    return cleanedCode;
  }

  private finalizeWrite(node: Node, writer: FileWriter, cleanedCode: string, prompt: string): void {
    writer.write(node.meta.path, cleanedCode);
    this.logAIResponse(node.id, prompt, cleanedCode);
  }

  async generateNodeTest(
    node: Node,
    testPath: string,
    implementationCode: string,
    stack = 'nextjs',
    writer: FileWriter
  ): Promise<string> {
    if (this.config.mockResponse) {
      const mockTest = `import { describe, it, expect } from 'vitest';\n// Mock test for ${node.id}\n`;
      writer.write(testPath, mockTest);
      return mockTest;
    }
    if (!this.provider) throw new Error(`AI Provider is not configured.`);

    const testFileExists = fs.existsSync(testPath);
    const currentTestCode = testFileExists ? fs.readFileSync(testPath, 'utf-8') : '';

    const implExt = path.extname(node.meta.path);
    const implBase = path.basename(node.meta.path, implExt);
    let importStatement = '';
    const stackLower = stack.toLowerCase();

    if (stackLower.includes('python')) {
      importStatement = `from .${implBase} import ...`;
    } else if (stackLower.includes('go') || stackLower === 'golang') {
      importStatement = `// package matches other files in same directory`;
    } else {
      importStatement = `import ${node.type === 'api-route' ? '* as handlerModule' : 'Component'} from './${implBase}';`;
    }

    let prompt: string;
    if (testFileExists && currentTestCode) {
      prompt = updateTestPrompt({
        implementationCode,
        implPath: node.meta.path,
        testPath,
        existingTestCode: currentTestCode,
        input: node.input,
        output: node.output,
        importStatement,
        constraints: node.constraints,
      });
    } else {
      prompt = newTestPrompt({
        implementationCode,
        implPath: node.meta.path,
        testPath,
        input: node.input,
        output: node.output,
        importStatement,
        constraints: node.constraints,
        tests: node.tests,
      });
    }

    const testSys = resolvePromptOverride(this.config.cwd || process.cwd(), 'test', TEST_SYSTEM);
    const testCode = await this.provider.generate(prompt, testSys, this.config.model, [], 0.3);
    const cleaned = this.cleanMarkdown(testCode);
    writer.write(testPath, cleaned);
    this.logAIResponse(node.id + "_test", prompt, cleaned);
    return cleaned;
  }

  async generateCombinedTest(
    nodes: Node[],
    stack: string,
    writer: FileWriter,
    cwd: string,
    index = 0
  ): Promise<string> {
    const combinedPath = `.pxml/all.${index}.test.ts`;
    if (this.config.mockResponse || !this.provider) {
      writer.write(combinedPath, `// Combined mock test for ${nodes.length} nodes\n`);
      return combinedPath;
    }

    const CHUNK_SIZE = 2;
    const nodeGroups: Node[][] = [];
    for (let i = 0; i < nodes.length; i += CHUNK_SIZE) {
      nodeGroups.push(nodes.slice(i, i + CHUNK_SIZE));
    }

    const allPaths: string[] = [];
    for (let g = 0; g < nodeGroups.length; g++) {
      const group = nodeGroups[g];
      const sections = group.map(n => {
        const implPath = path.resolve(cwd, n.meta.path);
        const implCode = fs.existsSync(implPath) ? fs.readFileSync(implPath, 'utf-8') : '';
        return `--- Node: ${n.id}
Implementation Path: ${n.meta.path}
Implementation Code:
\`\`\`
${implCode}
\`\`\`
XML Specs:
- Input: ${JSON.stringify(n.input)}
- Output: ${JSON.stringify(n.output)}
- Constraints: ${n.constraints.map(c => `[${c.verify}] ${c.description}`).join('; ')}
- Test Scenarios: ${JSON.stringify(n.tests)}
--- END`;
      });

      const prompt = combinedTestPrompt({ sections: sections.join('\n') });
      const comboSys = resolvePromptOverride(this.config.cwd || cwd, 'combined-test', COMBINED_TEST_SYSTEM);
      const response = await this.provider.generate(prompt, comboSys, this.config.model, [], 0.3);
      const cleaned = this.cleanMarkdown(response);

      const groupPath = nodeGroups.length > 1
        ? `.pxml/all.${index}.g${g}.test.ts`
        : combinedPath;
      writer.write(groupPath, cleaned);
      this.logAIResponse(`combined_test_g${g}`, prompt, cleaned);
      allPaths.push(groupPath);
    }

    return allPaths.join('\n');
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private buildPrompt(node: Node, projectContext: string, promptNote: string): string {
    return codegenUserPrompt({
      node: {
        id: node.id,
        type: node.type,
        flow: node.flow,
        path: node.meta.path,
        input: node.input,
        output: node.output,
        constraints: node.constraints,
        tests: node.tests,
        extends: node.extends,
      },
      projectContext,
      stack: '',
      promptNote,
      images: (node as any).images || [],
      importStatement: '',
    });
  }

  private tryStructuredExtract(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj.code) return obj.code;
        if (obj.content) return obj.content;
        if (obj.files && Array.isArray(obj.files)) {
          return obj.files.map((f: any) => f.content || '').join('\n');
        }
      } catch {}
    }
    return this.cleanMarkdown(raw);
  }

  private cleanMarkdown(code: string): string {
    let cleaned = code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    cleaned = cleaned.replace(/\s*→\s*skipped:.*$/gm, '');
    cleaned = cleaned.replace(/\s*\/\/\s*skipped:.*$/gm, '');
    return cleaned.trim();
  }

  private logAIResponse(nodeId: string, prompt: string, response: string) {
    const logsDir = path.resolve('.pxml', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const safeNodeId = nodeId.replace(/:/g, '_');
    const logPath = path.join(logsDir, `${safeNodeId}.log`);
    const logContent = `--- PROMPT ---\n${prompt}\n\n--- RESPONSE ---\n${response}\n`;
    fs.writeFileSync(logPath, logContent, 'utf-8');
  }
}

// ── System prompt override helpers ────────────────────────────────
function resolveSystemPrompt(cwd: string, key: string, fallback: string): string {
  return resolvePromptOverride(cwd, `system-${key}`, fallback);
}
