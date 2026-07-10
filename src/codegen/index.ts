import Anthropic from '@anthropic-ai/sdk';
import { Node } from '../parser/schema.js';
import { FileWriter } from '../writer/index.js';
import { getTestFilePath } from '../runner/index.js';
import { PxmlPatcher } from '../patcher/index.js';
import { validateNode } from '../validator/index.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`
};

// Hard import rules shared by all stacks.  The single biggest source of broken
// AI output is the model inventing import paths for package sub-components
// (e.g. `import ProductCard from '@/components/ui/ecommerce/ProductCard'`) that
// do not exist on disk — the installed package ships XML specs, not .tsx files.
export const IMPORT_RULES = `IMPORT RULES (CRITICAL — violating these causes build failures):
- You may ONLY import from: (a) standard packages (next, react, @testing-library/*, etc.), (b) the project '@/' alias for files declared as nodes in this project (e.g. '@/lib/db' for the shared.db node), (c) the installed UI component library at '@/components/ui/...' (real files copied into the project by 'pxml install' — e.g. '@/components/ui/layout/Container', '@/components/ui/ecommerce/ProductCard'), or (d) RELATIVE paths to other files in this project.
- You MUST NOT import from a bare package name (e.g. 'ui-ux-components-pxml') — the library is provided as files under '@/components/ui/...', not as an importable npm module.
- When a node EXTENDS a base component from an installed package, prefer importing the ready-made component from '@/components/ui/...' over re-implementing it. Only inline a sub-component if no matching base component exists.
- If you need a component that exists as another node in THIS project, import it via a RELATIVE path (e.g. '../components/Navbar') pointing to that node's declared <path>.
- DATABASE HELPER CONVENTION (all stacks): the node that sets up the shared database MUST (1) expose the connection instance under the identifier \`db\` (e.g. TS/JS: \`export const db = ...\`; Python: \`db = ...\` at module level; Go: a package-level \`var db\`), and (2) expose a small, consistent data-access API built ON TOP of that instance: \`run(sql, params?)\`, \`all(sql, params?)\`, \`get(sql, params?)\`, \`exec(sql)\`. Implement these by wrapping whatever database library the project uses. For engines that use prepared statements, SPREAD the params array into the call, e.g. \`db.prepare(sql).run(...(params ?? []))\` and \`db.prepare(sql).all(...(params ?? []))\` — never pass the array (or \`undefined\`) as a single positional argument, or the engine throws 'Too many parameter values'. Every other node that uses the database MUST import \`db\` (and those helpers) from the db-helper node and call ONLY those helpers — NEVER call raw/invented library methods (e.g. do not write \`db.execute(...)\` or \`db.prepare(...)\` directly; use the provided \`run\`/\`all\`/\`get\`/\`exec\`). This keeps the database API identical across all generated files regardless of the underlying engine.
- API RESPONSE CONVENTION (all stacks): a LIST endpoint (GET returning many items) MUST return the collection as the JSON ROOT (e.g. \`NextResponse.json(products)\`), NOT wrapped in an object like \`{ products: [...] }\`. Client code calls \`const data = await res.json()\` and treats \`data\` as the array directly. A SINGLE-item endpoint (GET by id, POST create) returns the object directly (e.g. \`NextResponse.json(product)\`). This keeps producers and consumers of an API in agreement without a shared schema file.
- REACT/CLIENT COMPONENT CONVENTION: in the Next.js App Router (and similar React meta-frameworks), ANY component or page that uses hooks (\`useState\`, \`useEffect\`, \`useRouter\`, \`useContext\`, etc.), browser-only APIs, or DOM event handlers MUST have the \`'use client'\` directive as the VERY FIRST line of the file. A module that omits it while using hooks fails at build/runtime with "You're importing a module that depends on X into a React Server Component". Server-only files (route handlers, pure server components) must NOT use hooks.`;

function getStackInstructions(stack: string): { systemPrompt: string; promptNote: string } {
  const stackLower = stack.toLowerCase();
  if (stackLower.includes('python')) {
    return {
      systemPrompt: `You are an expert Python developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax (like \`\`\`python) or explanations. Only output code.
CRITICAL: Use idiomatic Python code, follow PEP 8 styling, and make sure dependencies are imported correctly.`,
      promptNote: `Stack: Python. Use standard Python practices, requirements, and imports.`
    };
  } else if (stackLower.includes('rust')) {
    return {
      systemPrompt: `You are an expert Rust developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax (like \`\`\`rust) or explanations. Only output code.
CRITICAL: Write clean Rust code, manage lifetimes and ownership correctly, and follow Rust idioms.`,
      promptNote: `Stack: Rust. Use standard Rust syntax and crate references.`
    };
  } else if (stackLower.includes('go') || stackLower === 'golang') {
    return {
      systemPrompt: `You are an expert Go developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax (like \`\`\`go) or explanations. Only output code.
CRITICAL: Write idiomatic Go code, ensure correct package declaration, and format using gofmt standards.`,
      promptNote: `Stack: Go. Use standard Go packaging and syntax.`
    };
  } else if (stackLower.includes('c#') || stackLower === 'csharp' || stackLower.includes('dotnet')) {
    return {
      systemPrompt: `You are an expert C# developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax (like \`\`\`csharp) or explanations. Only output code.
CRITICAL: Use modern C# syntax, follow standard .NET conventions, and declare namespace/imports correctly.`,
      promptNote: `Stack: C# / .NET. Use standard .NET namespace and architecture.`
    };
  } else if (stackLower.includes('c++') || stackLower === 'cpp') {
    return {
      systemPrompt: `You are an expert C++ developer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax (like \`\`\`cpp) or explanations. Only output code.
CRITICAL: Use modern C++ standards (C++17/20), handle memory management correctly, and ensure clean header and source file separation.`,
      promptNote: `Stack: C++. Use standard C++ library and syntax.`
    };
  } else {
    return {
      systemPrompt: `You are an expert software engineer generating implementation code for a node specification.
Generate ONLY the file contents. Do not include markdown code block syntax (like \`\`\`typescript) or explanations. Only output code.
CRITICAL: The codebase uses ES Modules (ESM). You must STRICTLY use 'import ... from ...' syntax. NEVER generate CommonJS 'require(...)' calls.`,
      promptNote: `Stack: JS/TS (${stack}). Ensure ES Module format.`
    };
  }
}

export interface AIProvider {
  generate(prompt: string, systemPrompt: string, model: string): Promise<string>;
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  public stats = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
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
    if (response.usage) {
      this.stats.inputTokens += response.usage.input_tokens || 0;
      this.stats.outputTokens += response.usage.output_tokens || 0;
      const cacheRead = (response.usage as any).cache_read_input_tokens || 0;
      this.stats.cachedTokens += cacheRead;
    }
    return response.content[0].type === 'text' ? response.content[0].text : '';
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

  async generate(prompt: string, systemPrompt: string, model: string): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Number(process.env.PXML_API_TIMEOUT_MS) || 90000);

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
        if (data.usage) {
          this.stats.inputTokens += data.usage.prompt_tokens || 0;
          this.stats.outputTokens += data.usage.completion_tokens || 0;
          const cached = data.usage.prompt_tokens_details?.cached_tokens || 0;
          this.stats.cachedTokens += cached;
        }
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
  public stats = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(prompt: string, systemPrompt: string, model: string): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Number(process.env.PXML_API_TIMEOUT_MS) || 90000);

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
        if (data) {
          this.stats.inputTokens += data.prompt_eval_count || 0;
          this.stats.outputTokens += data.eval_count || 0;
        }
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
  skipVerification?: boolean;
  skipValidation?: boolean;
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

  getStats() {
    if (this.provider && 'stats' in this.provider) {
      return (this.provider as any).stats;
    }
    return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  }

  async generateDirect(prompt: string, systemPrompt: string): Promise<string> {
    if (!this.provider) {
      throw new Error(`AI Provider is not configured.`);
    }
    return this.provider.generate(prompt, systemPrompt, this.config.model);
  }

  async generateNodeCode(node: Node, projectContext: string, writer: FileWriter, stack = 'nextjs', cwd = process.cwd()): Promise<string> {
    const stackInfo = getStackInstructions(stack);
    if (node.type === 'setup-command') {
      if (this.config.mockResponse) {
        const mockCmd = this.config.mockResponse(node);
        console.log(`${colors.cyan(colors.bold('[SETUP-COMMAND]'))} Would execute: ${mockCmd}`);
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
- Stack: ${stack}
- Target: Run setup tasks (e.g. create project or install packages)
- Constraints:
${node.constraints.map(c => `  - [${c.verify}] ${c.description}`).join('\n')}

Generate ONLY the single-line shell command. Do not include explanation, comment, or markdown block wrapping.`;

      const systemPrompt = `You are a DevOps engineer generating setup shell commands. Generate ONLY the executable terminal command text. Do not wrap in markdown or backticks.`;
      const commandText = (await this.provider.generate(prompt, systemPrompt, this.config.model)).trim();
      
      console.log(`${colors.cyan(colors.bold('[SETUP-COMMAND]'))} Executing command: "${commandText}"`);

      // Conflict avoidance workaround for npx create-next-app .
      const isCreateNextApp = commandText.includes('create-next-app');
      const tempDir = path.join(process.cwd(), '../.pxml-temp-init');
      const conflictItems = ['project.xml', 'pxml.xsd', 'pxml.json', 'flows', 'shared', 'packages', '.pxml', 'components', 'README.md', 'LICENSE', '.gitignore', 'bugs_history.xml', 'bugs.xsd', 'AGENTS.md', 'CLAUDE.md'];
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

    const prompt = this.buildPrompt(node, projectContext, stackInfo.promptNote);
    const systemPrompt = stackInfo.systemPrompt + '\n' + IMPORT_RULES;
    
    const code = await this.provider.generate(prompt, systemPrompt, this.config.model);
    let cleanedCode = this.cleanMarkdown(code);

    // AI Code Verification & Self-Correction step (opt-in, saves 2x tokens per node)
    if (!this.config.skipVerification) {
    try {
      const verificationPrompt = `Verify the correctness and deployment stability of the following generated code for node '${node.id}'.
Destination Path: ${node.meta.path}
Constraints:
${node.constraints.map(c => `  - [${c.verify}] ${c.description}`).join('\n')}

Generated Code:
${cleanedCode}

Analyze the code. Are there any bugs, schema inconsistencies, or missing imports/exports? 
In particular, check that EVERY import statement resolves to a real file or npm package. The installed UI library lives under '@/components/ui/...' (real files) and bare package-name imports (e.g. 'ui-ux-components-pxml') are NOT valid — use '@/components/ui/...' instead.
If there are issues, output the corrected code. If the code is fully stable, output the word "STABLE".`;

      const verificationResponse = await this.provider.generate(verificationPrompt, "You are a senior code reviewer. Return ONLY the corrected code or the exact word 'STABLE'. Do not include markdown code blocks or explanations.", this.config.model);
      const cleanedVerification = this.cleanMarkdown(verificationResponse);
      
      if (cleanedVerification.toUpperCase() !== 'STABLE' && cleanedVerification.length > 20) {
        console.log(`${colors.green(colors.bold('[VERIFY]'))} AI self-corrected generated code for node: ${node.id}`);
        cleanedCode = cleanedVerification;
      }
    } catch (err: any) {
      console.warn(`[VERIFY WARNING] Self-verification step skipped: ${err.message}`);
    }
    }

    writer.write(node.meta.path, cleanedCode);
    this.logAIResponse(node.id, prompt, cleanedCode);

    // Deterministic per-file validation + auto-fix.  The stack's native checker
    // (tsc / py_compile / go vet / cargo check) is the oracle, so type/syntax
    // errors are caught and fixed immediately after generation — independent of
    // model quality.  Skipped for nodes that produce no code file.
    if (!this.config.skipValidation && node.meta.path && node.type !== 'setup-command') {
      const maxV = 3;
      for (let attempt = 1; attempt <= maxV; attempt++) {
        const vres = validateNode(node, cwd, stack);
        if (vres.ok) break;

        if (attempt === 1) {
          console.log(`${colors.yellow(colors.bold('[VALIDATE]'))} Node ${node.id} has syntax/type errors, auto-fixing (compiler as oracle)...`);
        }

        const absPath = path.resolve(cwd, node.meta.path);
        const cur = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : cleanedCode;
        const fixPrompt = `You are a software repair AI. The following generated file has syntax/type errors reported by the compiler/linter.
Path: ${node.meta.path}
Reported Errors:
${vres.errors}

Current Code:
\`\`\`typescript
${cur}
\`\`\`

${IMPORT_RULES}

Generate SEARCH/REPLACE blocks to fix ONLY the reported errors in ${node.meta.path}.
- Use the header "FILE: ${node.meta.path}" followed by a <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE block.
- If an error is caused by a MISSING DEPENDENCY (a package that is not installed), do NOT edit the code for it — instead output the exact word NODEP and nothing else, so it can be handled separately.
- Otherwise output only the patch.`;

        try {
          const patch = await this.generateDirect(fixPrompt, 'Generate only SEARCH/REPLACE patch block, or the word NODEP if a dependency is missing.');
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

  async generateNodeTest(node: Node, testPath: string, implementationCode: string, stack = 'nextjs', writer: FileWriter): Promise<string> {
    if (this.config.mockResponse) {
      const mockTest = `import { describe, it, expect } from 'vitest';\n// Mock test for ${node.id}\n`;
      writer.write(testPath, mockTest);
      return mockTest;
    }

    if (!this.provider) {
      throw new Error(`AI Provider is not configured.`);
    }

    const testFileExists = fs.existsSync(testPath);
    const currentTestCode = testFileExists ? fs.readFileSync(testPath, 'utf-8') : '';

    const systemPrompt = `You are an expert QA and software testing engineer.
Generate ONLY the complete test file contents. Do not include markdown code block syntax (like \`\`\`typescript) or explanations. Only output test code.
CRITICAL: The test framework matches the stack. For JS/TS, use Vitest. For Python, use pytest. For Go, use testing. For C#, use xUnit or NUnit.
CRITICAL: Never attempt to bind/start a live HTTP server or make real external network calls. Always mock inputs, mock requests, mock responses, and use virtual mock routing/internal test request objects (e.g., mock 'Request' in Next.js, 'httptest' in Go, 'responses' or mock frameworks in Python/C#).
CRITICAL: For Next.js page components where 'searchParams' is a Promise (Next.js 15/React 19), always wrap the rendered component in '<Suspense>' inside the test to prevent suspension boundary errors.
CRITICAL: In JS/TS component tests, always add '// @vitest-environment jsdom' at the very top of the test file. Tests are co-located in the same folder as code, so always use local relative paths (e.g. './page' or './route') for importing the implementation code. Never use path aliases (like '@/...').
CRITICAL: When mocking constructors or classes (such as 'better-sqlite3' Database), always mock them using a standard JavaScript class (e.g., 'default: class { ... }') instead of an arrow function (e.g., 'default: () => ...') to prevent 'is not a constructor' TypeErrors.
CRITICAL: To ensure the DOM is cleared between tests when Vitest globals are disabled, always import 'cleanup' and call 'afterEach(cleanup)' explicitly in the test file (e.g. 'import { cleanup } from "@testing-library/react"; afterEach(cleanup);').`;

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

    let prompt = '';
    if (testFileExists && currentTestCode) {
      prompt = `Improve and update the existing test file for this node to match the updated implementation and specifications.
Implementation File Path: ${node.meta.path}
Implementation Code:
\`\`\`
${implementationCode}
\`\`\`

Test File Path: ${testPath}
Existing Test Code:
\`\`\`
${currentTestCode}
\`\`\`

XML Specifications:
- Input Fields: ${JSON.stringify(node.input)}
- Output Fields: ${JSON.stringify(node.output)}
- Import Directive: ${importStatement} (You MUST use exactly this relative import statement to import the code being tested. Do not use path aliases like '@/...' or other paths.)
- Constraints: ${node.constraints.map(c => `[${c.verify}] ${c.description}`).join('\n')}

Generate the updated complete test code. Do not include markdown wrapping or explanation.`;
    } else {
      prompt = `Generate a comprehensive test file for the following implementation node based on its specification and code.
Implementation File Path: ${node.meta.path}
Implementation Code:
\`\`\`
${implementationCode}
\`\`\`

Target Test File Path: ${testPath}
XML Specifications:
- Input Fields: ${JSON.stringify(node.input)}
- Output Fields: ${JSON.stringify(node.output)}
- Import Directive: ${importStatement} (You MUST use exactly this relative import statement to import the code being tested. Do not use path aliases like '@/...' or other paths.)
- Constraints: ${node.constraints.map(c => `[${c.verify}] ${c.description}`).join('\n')}
- Defined Test Scenarios: ${JSON.stringify(node.tests)}

Generate the complete test code. Do not include markdown wrapping or explanation.`;
    }

    const testCode = await this.provider.generate(prompt, systemPrompt, this.config.model);
    const cleaned = this.cleanMarkdown(testCode);
    writer.write(testPath, cleaned);
    this.logAIResponse(node.id + "_test", prompt, cleaned);
    return cleaned;
  }

  async generateCombinedTest(nodes: Node[], stack: string, writer: FileWriter, cwd: string, index = 0): Promise<string> {
    const combinedPath = `.pxml/all.${index}.test.ts`;
    if (this.config.mockResponse || !this.provider) {
      writer.write(combinedPath, `// Combined mock test for ${nodes.length} nodes\n`);
      return combinedPath;
    }

    const sections = nodes.map(node => {
      const implPath = path.resolve(cwd, node.meta.path);
      const implCode = fs.existsSync(implPath) ? fs.readFileSync(implPath, 'utf-8') : '';
      return `--- Node: ${node.id}
Implementation Path: ${node.meta.path}
Implementation Code:
\`\`\`
${implCode}
\`\`\`
XML Specs:
- Input: ${JSON.stringify(node.input)}
- Output: ${JSON.stringify(node.output)}
- Constraints: ${node.constraints.map(c => `[${c.verify}] ${c.description}`).join('; ')}
- Test Scenarios: ${JSON.stringify(node.tests)}
--- END`;
    });

    const prompt = `You are generating a SINGLE combined Vitest test file that tests ALL of the following implementation nodes.
Import each implementation using a local relative path (e.g. \`import Component from './page'\` or \`import * as handler from './route'\`).
Export default a React component if needed. Never use path aliases (like '@/...').

For Next.js page components with Promise searchParams, wrap in '<Suspense>'.
In JS/TS component tests, add '// @vitest-environment jsdom' at the top.
Import 'cleanup' from "@testing-library/react" and call afterEach(cleanup).
Never make real network calls — always mock requests, responses, DB.

Only output the complete test code, no markdown fences, no explanation.
Write ONE combined file that covers all nodes below.

${sections.join('\n')}`;

    const systemPrompt = 'You are an expert QA engineer generating Vitest tests. Output ONLY code.';
    const response = await this.provider.generate(prompt, systemPrompt, this.config.model);
    const cleaned = this.cleanMarkdown(response);
    writer.write(combinedPath, cleaned);
    this.logAIResponse('combined_test', prompt, cleaned);
    return combinedPath;
  }

  private buildPrompt(node: Node, projectContext: string, promptNote: string): string {
    const extendsInfo = node.extends
      ? `- Extends Base Component: ${node.extends}\n  (This base is a SPEC from an installed package — INLINE its sub-components; do NOT import it.)\n`
      : '';
    return `Project Context:
${projectContext}

Generate implementation file for this node:
- ID: ${node.id}
- Type: ${node.type}
- Flow: ${node.flow}
- Destination Path: ${node.meta.path}
- Input Fields: ${JSON.stringify(node.input)}
- Output Fields: ${JSON.stringify(node.output)}
- ${promptNote}
${extendsInfo}- Constraints:
${node.constraints.map(c => `  - [${c.verify}] ${c.description}${c.learnedFrom ? ` (Learned from bug: ${c.learnedFrom})` : ''}`).join('\n')}

IMPORTANT: Only import from npm packages or RELATIVE paths to files declared as nodes in this project (listed in Project Context above). Do NOT import from '@/components/ui/...' or package names. If the node extends a base component, inline its sub-components into this file.

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
