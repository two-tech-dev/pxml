#!/usr/bin/env node
import { Command } from 'commander';
import { PxmlParser, validateProject } from '../parser/index.js';
import { DependencyGraph } from '../graph/index.js';
import { PxmlManifest } from '../manifest/index.js';
import { PxmlCache } from '../cache/index.js';
import { PxmlCodegen } from '../codegen/index.js';
import { PxmlRunner, getTestFilePath } from '../runner/index.js';
import { FileWriter } from '../writer/index.js';
import { runFixLoop } from './fix.js';
import { syncEditorSchema, addCatalogToVscodeSettings } from '../editor-schema/index.js';
import { createDefaultManifest, addPackageToManifest, installPackages } from '../install/index.js';
import { execSync } from 'child_process';
import { XMLParser } from 'fast-xml-parser';
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

const program = new Command();

program
  .name('pxml')
  .description('pxml compiler and build tool')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize sample pxml project structure')
  .action(() => {
    const cwd = process.cwd();
    const configPath = path.join(cwd, 'project.xml');
    
    if (fs.existsSync(configPath)) {
      console.log('Project already initialized.');
      return;
    }

    // Create example directory structure for flows and packages
    fs.mkdirSync(path.join(cwd, 'flows'), { recursive: true });
    fs.mkdirSync(path.join(cwd, 'shared'), { recursive: true });
    fs.mkdirSync(path.join(cwd, 'packages', 'init-nextjs-project'), { recursive: true });

    const mainXml = `<project name="my-app" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="pxml.xsd">
  <import package="init-nextjs-project" from="packages/init-nextjs-project" as="nextjs-init" />
  <import src="./flows/blog.xml" as="blog" />

  <node id="setup.nextjs" type="setup-command" flow="setup" extends="nextjs-init:base-setup" />

  <node id="ui.home" type="ui-component" flow="navigation">
    <meta>
      <path>app/page.tsx</path>
      <depends_on>setup.nextjs</depends_on>
    </meta>
    <constraint verify="static">File exports default React component</constraint>
    <constraint verify="static">Page contains a link with href="/posts"</constraint>
    <constraint verify="llm-judge">Replace the entire homepage with a beautifully styled landing page (clean dark theme, tailwind classes). Do not call any dashboard APIs like /api/network or /api/ram. Show a hero section, and a prominent link/button pointing to the Posts page at '/posts'.</constraint>
  </node>
</project>`;

    const initNextjsProjectXml = `<project name="init-nextjs-project" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="../../pxml.xsd">
  <node id="base-setup" type="setup-command" flow="setup">
    <meta>
      <path>package.json</path>
    </meta>
    <constraint verify="static">Initialize Next.js app in the current directory non-interactively. Run: npx create-next-app@latest . --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --yes && npm install better-sqlite3 && npm install --save-dev @types/better-sqlite3 @testing-library/react @testing-library/jest-dom jsdom vitest</constraint>
  </node>
</project>`;

    const blogXml = `<project name="blog-flow" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="../pxml.xsd">
  <node id="api.posts.create" type="api-route" flow="blog.write">
    <meta>
      <path>app/api/posts/route.ts</path>
    </meta>
    <input>
      <field name="title" type="string" required="true" />
      <field name="content" type="string" required="true" />
    </input>
    <output>
      <field name="success" type="boolean" required="true" />
    </output>
    <constraint verify="static">Initialize a better-sqlite3 database named 'blog.db'. Create a 'posts' table with columns id (INTEGER PRIMARY KEY), title (TEXT), and content (TEXT) if it does not exist. Implement both POST (to insert a post) and GET (to select all posts) handlers in this route file. Ensure the route is dynamic and not cached by exporting: export const dynamic = 'force-dynamic';</constraint>
    <test>
      <name>Create post successful</name>
      <given>
        <body json="true">
          <title>Hello World</title>
          <content>My first post</content>
        </body>
      </given>
      <expect>
        <status>200</status>
        <contains>success</contains>
      </expect>
    </test>
  </node>

  <node id="ui.posts.page" type="ui-component" flow="blog.read">
    <meta>
      <path>app/posts/page.tsx</path>
      <depends_on>api.posts.create</depends_on>
    </meta>
    <input>
      <field name="searchParams" type="object" required="false" />
    </input>
    <constraint verify="static">Create a beautifully designed blog posts manager page at app/posts/page.tsx (clean dark layout, tailwind cards, inputs, and buttons). It must fetch posts from '/api/posts' on render/mount, display them, and show a form to submit new posts via a POST request to '/api/posts'. Refresh the posts list automatically on successful submission.</constraint>
  </node>
</project>`;

    const fileUrl = new URL(import.meta.url);
    const sourceXsd = path.resolve(path.dirname(fileUrl.pathname), '../../pxml.xsd');
    if (fs.existsSync(sourceXsd)) {
      fs.copyFileSync(sourceXsd, path.join(cwd, 'pxml.xsd'));
    } else {
      const fallbackXsd = path.resolve(cwd, 'pxml.xsd');
      if (!fs.existsSync(fallbackXsd)) {
        const workspaceXsd = path.resolve(path.dirname(fileUrl.pathname), '../../../pxml.xsd');
        if (fs.existsSync(workspaceXsd)) {
          fs.copyFileSync(workspaceXsd, path.join(cwd, 'pxml.xsd'));
        }
      }
    }

    const sourceBugsXsd = path.resolve(path.dirname(fileUrl.pathname), '../../bugs.xsd');
    if (fs.existsSync(sourceBugsXsd)) {
      fs.copyFileSync(sourceBugsXsd, path.join(cwd, 'bugs.xsd'));
    } else {
      const fallbackBugsXsd = path.resolve(cwd, 'bugs.xsd');
      if (!fs.existsSync(fallbackBugsXsd)) {
        const workspaceBugsXsd = path.resolve(path.dirname(fileUrl.pathname), '../../../bugs.xsd');
        if (fs.existsSync(workspaceBugsXsd)) {
          fs.copyFileSync(workspaceBugsXsd, path.join(cwd, 'bugs.xsd'));
        }
      }
    }

    const bugsHistoryXml = `<bugs xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="bugs.xsd">
  <bug id="db.locking" flow="blog.write">
    SQLite database file locks when executing parallel write operations. Ensure connections are closed properly or run db queries sequentially.
  </bug>
</bugs>`;

    fs.writeFileSync(configPath, mainXml, 'utf-8');
    fs.writeFileSync(path.join(cwd, 'flows', 'blog.xml'), blogXml, 'utf-8');
    fs.writeFileSync(path.join(cwd, 'packages', 'init-nextjs-project', 'project.xml'), initNextjsProjectXml, 'utf-8');

    // Generate enriched schema + catalog for init-nextjs-project package
    const pkgDir = path.join(cwd, 'packages', 'init-nextjs-project');
    const coreXsdBuf = fs.readFileSync(path.join(cwd, 'pxml.xsd'), 'utf-8');
    const enriched = coreXsdBuf
      .replace(
        '<xs:attribute name="flow" type="xs:string" use="required"/>',
        '<xs:attribute name="flow" type="UiFlowType" use="required"/>'
      )
      .replace(
        '<xs:attribute name="type" type="xs:string" use="required"/>',
        '<xs:attribute name="type" type="UiNodeType" use="required"/>'
      )
      .replace(
        '<xs:attribute name="extends" type="xs:string" use="optional"/>',
        '<xs:attribute name="extends" type="UiExtendsType" use="optional"/>'
      )
      .replace('</xs:schema>', `
  <xs:simpleType name="UiFlowType">
    <xs:union>
      <xs:simpleType><xs:restriction base="xs:string">
        <xs:enumeration value="setup"/>
        <xs:enumeration value="navigation"/>
        <xs:enumeration value="blog.write"/>
        <xs:enumeration value="blog.read"/>
      </xs:restriction></xs:simpleType>
      <xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
    </xs:union>
  </xs:simpleType>
  <xs:simpleType name="UiNodeType">
    <xs:union>
      <xs:simpleType><xs:restriction base="xs:string">
        <xs:enumeration value="setup-command"/>
        <xs:enumeration value="ui-component"/>
        <xs:enumeration value="api-route"/>
        <xs:enumeration value="db-model"/>
        <xs:enumeration value="config-file"/>
      </xs:restriction></xs:simpleType>
      <xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
    </xs:union>
  </xs:simpleType>
  <xs:simpleType name="UiExtendsType">
    <xs:union>
      <xs:simpleType><xs:restriction base="xs:string">
        <xs:enumeration value="nextjs-init:base-setup"/>
      </xs:restriction></xs:simpleType>
      <xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
    </xs:union>
  </xs:simpleType>
</xs:schema>`);
    fs.writeFileSync(path.join(pkgDir, 'init-nextjs-project.xsd'), enriched);
    const initCatalog = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
  <system systemId="pxml.xsd" uri="init-nextjs-project.xsd"/>
</catalog>
`;
    fs.writeFileSync(path.join(pkgDir, 'catalog.xml'), initCatalog);
    addCatalogToVscodeSettings(cwd, 'packages/init-nextjs-project/catalog.xml');
    createDefaultManifest(cwd);

    fs.writeFileSync(path.join(cwd, 'bugs_history.xml'), bugsHistoryXml, 'utf-8');
    console.log('Successfully initialized Next.js project with pxml templates.');
  });

program
  .command('compile')
  .description('Compile XML nodes to implementation code')
  .option('--dry-run', 'Show execution plan without writing changes')
  .option('--no-autogen-tests', 'Disable automatic test case generation')
  .option('--verify', 'Run AI self-verification on generated code (doubles tokens per node)')
  .option('--provider <provider>', 'AI Provider (anthropic, openai, or ollama)', 'anthropic')
  .option('--apiKey <key>', 'API key')
  .option('--baseUrl <url>', 'Base API URL for OpenAI compatible provider')
  .option('--model <model>', 'LLM model name', 'claude-3-5-sonnet')
  .action(async (options) => {
    const cwd = process.cwd();
    const projectXml = path.join(cwd, 'project.xml');
    if (!fs.existsSync(projectXml)) {
      console.error('project.xml not found. Run pxml init first.');
      process.exit(1);
    }

    const parser = new PxmlParser();
    const project = parser.parse(projectXml);
    try {
      validateProject(project);
    } catch (err: any) {
      console.error(err.message);
      process.exit(1);
    }
    syncEditorSchema(cwd, project);
    injectHistoricalBugs(project.nodes, cwd);
    const graph = new DependencyGraph(project.nodes);
    const order = graph.getSortOrder();

    const manifest = new PxmlManifest(cwd, project.name, project.version);
    const writer = new FileWriter(!!options.dryRun);

    const apiKey = options.apiKey || (options.provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);

    const codegen = new PxmlCodegen({
      provider: options.provider as any,
      apiKey: apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
      skipVerification: !options.verify
    });

    console.log(`Compiling project ${project.name} (stack: ${project.stack})...`);

    const extendedNodeIds = new Set<string>();
    for (const node of project.nodes) {
      if (node.extends) {
        extendedNodeIds.add(node.extends);
      }
    }

    // Collect package import aliases (from `from=` / `package=` imports, not `src=`)
    // so we can skip base-component nodes that are never extended by the user.
    const packageAliases = new Set<string>();
    try {
      const rawXml = fs.readFileSync(path.join(cwd, 'project.xml'), 'utf-8');
      for (const el of rawXml.match(/<import\b[^>]*>/g) ?? []) {
        if (/from\s*=/.test(el) || /package\s*=/.test(el)) {
          const am = el.match(/\bas\s*=\s*["']([^"']+)["']/);
          if (am) packageAliases.add(am[1]);
        }
      }
    } catch { /* best-effort */ }

    const compiledNodeIds: string[] = [];
    const allTestFiles: string[] = [];

    for (const nodeId of order) {
      if (extendedNodeIds.has(nodeId)) {
        continue;
      }
      // Skip unused package bases (e.g. all ~150 base components from the UI
      // library that the user never extends).  A "package base" is any node
      // whose id starts with a package import alias (from `from=` / `package=`,
      // not `src=` flow files).
      if (packageAliases.size > 0 &&
          [...packageAliases].some(a => nodeId.startsWith(`${a}:`))) {
        continue;
      }
      const node = project.nodes.find(n => n.id === nodeId)!;
      const xmlHash = PxmlCache.hashNode(node);
      const cached = manifest.getNode(nodeId);

      if (cached && cached.xml_hash === xmlHash) {
        console.log(`${colors.yellow('[SKIP]')} Node ${nodeId} has not changed.`);
        continue;
      }

      if (cached && cached.locked) {
        console.log(`${colors.red(colors.bold('[LOCKED]'))} Node ${nodeId} is locked. Skipping codegen.`);
        continue;
      }

      // Build project context: only include files from nodes that the current
      // node directly depends on, capped to reduce token cost.
      const MAX_FILE_CHARS = 2000;
      const nodeMap = new Map(project.nodes.map(n => [n.id, n]));
      const dependents = node.meta.depends_on;
      let projectContext = project.nodes.map(n => `Node: ${n.id}, Path: ${n.meta.path}`).join('\n');
      projectContext += '\n\n--- Relevant dependency files ---\n';

      const manifestData = manifest.get();
      for (const [mNodeId, mNode] of Object.entries(manifestData.nodes)) {
        if (!dependents.includes(mNodeId)) continue;
        for (const filePath of mNode.output_files) {
          const absPath = path.resolve(cwd, filePath);
          if (fs.existsSync(absPath)) {
            const content = fs.readFileSync(absPath, 'utf-8');
            if (content.length <= MAX_FILE_CHARS) {
              projectContext += `\n--- File: ${filePath} (Node: ${mNodeId}) ---\n${content}\n`;
            } else {
              const truncated = content.slice(0, MAX_FILE_CHARS);
              const remaining = content.slice(MAX_FILE_CHARS).split('\n').length;
              projectContext += `\n--- File: ${filePath} (Node: ${mNodeId}) [partial, ~${remaining} lines elided] ---\n${truncated}\n`;
            }
          }
        }
      }

      console.log(`${colors.cyan(colors.bold('[CODEGEN]'))} Generating code for node: ${nodeId}`);
      try {
        const code = await codegen.generateNodeCode(node, projectContext, writer, project.stack);
        
        const testFilePath = getTestFilePath(node.meta.path, project.stack);
        const testXmlHash = PxmlCache.hashNodeTests(node);
        const cachedTestHash = (cached as any)?.test_xml_hash;
        const absTestFilePath = path.resolve(cwd, testFilePath);
        const shouldAutogen = options.autogenTests && node.autogenTests;

        if (shouldAutogen && node.type !== 'setup-command' && node.type !== 'config-file') {
          if (!cached || cached.xml_hash !== xmlHash || !fs.existsSync(absTestFilePath) || cachedTestHash !== testXmlHash) {
            console.log(`${colors.magenta(colors.bold('[TESTGEN]'))} Generating/Updating test file at: ${testFilePath}`);
            await codegen.generateNodeTest(node, absTestFilePath, code, project.stack, writer);
          }
          allTestFiles.push(absTestFilePath);
        }

        manifest.setNode(nodeId, {
          node_id: nodeId,
          source_file: 'project.xml',
          xml_hash: xmlHash,
          test_xml_hash: testXmlHash,
          output_files: (shouldAutogen && node.type !== 'setup-command' && node.type !== 'config-file') ? [node.meta.path, testFilePath] : [node.meta.path],
          depends_on: node.meta.depends_on,
          flow: node.flow,
          generated_at: new Date().toISOString()
        } as any);
        manifest.save();
        compiledNodeIds.push(nodeId);
      } catch (err: any) {
        console.error(`[ERROR] Failed to compile node ${nodeId}: ${err.message}`);
        writer.rollback();
        process.exit(1);
      }
    }

    if (compiledNodeIds.length > 0) {
      const runner = new PxmlRunner(cwd, writer);
      const bugContext = buildBugContext(cwd);
      let allPassed = true;

      // Single batch test run — run ALL test files at once, not per-node.
      const testFiles = allTestFiles.filter(f => fs.existsSync(f));
      if (testFiles.length > 0) {
        console.log(colors.cyan(colors.bold(`\nRunning ${testFiles.length} test file(s)...`)));
        const testCmd = `npx vitest run ${testFiles.join(' ')}`;
        let batchPassed = false;
        try {
          execSync(testCmd, { stdio: 'pipe', cwd });
          batchPassed = true;
        } catch {
          batchPassed = false;
        }
        if (batchPassed) {
          console.log(colors.green(colors.bold('\n[TEST] All tests passed.')));
        } else {
          console.log(colors.yellow(colors.bold('\n[TEST] Some tests failed. Attempting self-healing...')));
          // Fix each failing node in dependency order
          for (const nodeId of compiledNodeIds) {
            const node = project.nodes.find(n => n.id === nodeId)!;
            if (node.type === 'setup-command' || node.type === 'config-file') continue;
            const res = runner.runNodeTests(node, project.stack);
            if (!res.passed) {
              console.log(`${colors.red(colors.bold('[FIX]'))} Node ${node.id} failed. Self-healing...`);
              const success = await runFixLoop(node, cwd, manifest, codegen, runner, writer, undefined, bugContext, true, project.stack);
              if (!success) {
                allPassed = false;
                console.log(`${colors.red(colors.bold('[FAIL]'))} Node ${node.id} could not self-heal.`);
              } else {
                console.log(`${colors.green(colors.bold('[PASS]'))} Node ${node.id} healed.`);
              }
            }
          }
        }
      }
      
      if (!allPassed) {
        console.error(colors.red(colors.bold('\n[ERROR] Some compiled nodes failed tests and could not self-heal.')));
        process.exit(1);
      }
    }

    const stats = codegen.getStats();
    if (stats.inputTokens > 0 || stats.outputTokens > 0) {
      const cost = calculateEstimatedCost(options.model, stats);
      console.log(`\nToken Usage & Cost Summary:`);
      console.log(`- Input Tokens: ${stats.inputTokens} (Cached: ${stats.cachedTokens})`);
      console.log(`- Output Tokens: ${stats.outputTokens}`);
      console.log(`- Estimated Cost: $${cost.toFixed(4)}`);
    }

    console.log('Compilation finished successfully.');
  });

program
  .command('validate')
  .description('Validate XML files against schema and rules')
  .action(() => {
    const cwd = process.cwd();
    const projectXml = path.join(cwd, 'project.xml');
    if (!fs.existsSync(projectXml)) {
      console.error('project.xml not found. Run pxml init first.');
      process.exit(1);
    }

    try {
      const parser = new PxmlParser();
      const project = parser.parse(projectXml);
      validateProject(project);
      syncEditorSchema(cwd, project);
      console.log('Project validation successful.');
    } catch (err: any) {
      console.error(err.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Run Vitest test suite on all compiled nodes')
  .action(() => {
    const cwd = process.cwd();
    const projectXml = path.join(cwd, 'project.xml');
    if (!fs.existsSync(projectXml)) {
      console.error('project.xml not found. Run pxml init first.');
      process.exit(1);
    }

    const parser = new PxmlParser();
    const project = parser.parse(projectXml);
    const manifest = new PxmlManifest(cwd, project.name, project.version);
    const writer = new FileWriter();
    const runner = new PxmlRunner(cwd, writer);

    let allPassed = true;
    for (const node of project.nodes) {
      console.log(`[TEST] Running tests for node: ${node.id}`);
      const res = runner.runNodeTests(node, project.stack);
      
      const existing = manifest.getNode(node.id);
      if (existing) {
        manifest.setNode(node.id, {
          ...existing,
          last_test_run: res.results
        });
        manifest.save();
      }

      if (!res.passed) {
        allPassed = false;
        console.log(`[FAIL] Node ${node.id} failed tests.`);
      } else {
        console.log(`[PASS] Node ${node.id} tests passed.`);
      }
    }

    if (allPassed) {
      console.log('All tests passed successfully.');
    } else {
      process.exit(1);
    }
  });

program
  .command('diagnose')
  .description('Diagnose logs and locate nodes with issues')
  .option('--log <logFile>', 'Path to log file to parse')
  .action((options) => {
    const cwd = process.cwd();
    const logFilePath = options.log ? path.resolve(options.log) : null;
    if (!logFilePath || !fs.existsSync(logFilePath)) {
      console.error('Log file not found or not specified. Usage: pxml diagnose --log <path>');
      process.exit(1);
    }

    const logContent = fs.readFileSync(logFilePath, 'utf-8');
    const logs = logContent.split('\n').map(line => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return { message: line };
      }
    });

    const PxmlDiagnostics = require('../diagnostics/index.js').PxmlDiagnostics;
    console.log('Running diagnostics on logs...');

    for (const log of logs) {
      const diagnosis = PxmlDiagnostics.diagnoseHeuristic(log);
      if (diagnosis) {
        console.log(`[DIAGNOSIS] Suspected issue in flow: "${diagnosis.flow}" (Node type: "${diagnosis.suspectedType}")`);
        console.log(`  Reason: "${log.message}"`);
      }
    }
  });

program
  .command('fix')
  .description('Invoke self-healing loop for failed nodes')
  .option('--flow <flowName>', 'Fix specific flow')
  .option('--node <nodeId>', 'Fix specific node')
  .option('--bug <bugLogOrText>', 'Path to raw error log or custom description text to aid the fix loop')
  .option('--provider <provider>', 'AI Provider (anthropic, openai, or ollama)', 'anthropic')
  .option('--apiKey <key>', 'API key')
  .option('--baseUrl <url>', 'Base API URL for OpenAI compatible provider')
  .option('--model <model>', 'LLM model name', 'claude-3-5-sonnet')
  .action(async (options) => {
    const cwd = process.cwd();
    const projectXml = path.join(cwd, 'project.xml');
    if (!fs.existsSync(projectXml)) {
      console.error('project.xml not found. Run pxml init first.');
      process.exit(1);
    }

    const parser = new PxmlParser();
    const project = parser.parse(projectXml);
    const manifest = new PxmlManifest(cwd, project.name, project.version);
    const writer = new FileWriter();
    const runner = new PxmlRunner(cwd, writer);

    const apiKey = options.apiKey || (options.provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);

    const codegen = new PxmlCodegen({
      provider: options.provider as any,
      apiKey: apiKey,
      baseUrl: options.baseUrl,
      model: options.model
    });

    let targetNodes = project.nodes;
    if (options.node) {
      targetNodes = targetNodes.filter(n => n.id === options.node);
    } else if (options.flow) {
      targetNodes = targetNodes.filter(n => n.flow === options.flow);
    }

    let bugContext = '';
    if (options.bug) {
      if (fs.existsSync(options.bug)) {
        bugContext = fs.readFileSync(options.bug, 'utf-8');
      } else {
        bugContext = options.bug;
      }
    }

    // Load bugs_history.xml if it exists to add regression prevention checklist
    const bugsHistoryPath = path.join(cwd, 'bugs_history.xml');
    if (fs.existsSync(bugsHistoryPath)) {
      try {
        const historyXml = fs.readFileSync(bugsHistoryPath, 'utf-8');
        const optionsXml = {
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          allowBooleanAttributes: true,
          parseAttributeValue: true,
        };
        const fastXml = new XMLParser(optionsXml);
        const parsed = fastXml.parse(historyXml);
        if (parsed.bugs && parsed.bugs.bug) {
          const rawBugs = Array.isArray(parsed.bugs.bug) ? parsed.bugs.bug : [parsed.bugs.bug];
          let historyText = '\n--- Historical Bug Prevention Checklist (Ensure these bugs do not exist in the code) ---\n';
          for (const bug of rawBugs) {
            const flowAttr = bug['@_flow'] || 'general';
            const desc = typeof bug === 'object' ? bug['#text'] || bug.description || '' : String(bug);
            historyText += `- [Flow: ${flowAttr}] Bug ID ${bug['@_id']}: ${desc.trim()}\n`;
          }
          bugContext = bugContext ? `${bugContext}\n${historyText}` : historyText;
        }
      } catch (err: any) {
        console.warn(`[WARNING] Failed to parse bugs_history.xml: ${err.message}`);
      }
    }

    for (const node of targetNodes) {
      // Check if node is failing tests, or force fix if a custom bug context is provided
      console.log(`[FIX] Verifying node: ${node.id}`);
      const testRes = runner.runNodeTests(node, project.stack);
      if (!testRes.passed || bugContext) {
        // If bugContext is provided, force run at least once by passing a flag or bypassing check
        const success = await runFixLoop(node, cwd, manifest, codegen, runner, writer, undefined, bugContext, !!bugContext, project.stack);
        if (success) {
          console.log(`[FIX] Node ${node.id} healed successfully.`);
        } else {
          console.error(`[FIX] Could not self-heal node ${node.id}.`);
        }
      } else {
        console.log(`[FIX] Node ${node.id} is healthy.`);
      }
    }

    const stats = codegen.getStats();
    if (stats.inputTokens > 0 || stats.outputTokens > 0) {
      const cost = calculateEstimatedCost(options.model, stats);
      console.log(`\nToken Usage & Cost Summary (Fix Loop):`);
      console.log(`- Input Tokens: ${stats.inputTokens} (Cached: ${stats.cachedTokens})`);
      console.log(`- Output Tokens: ${stats.outputTokens}`);
      console.log(`- Estimated Cost: $${cost.toFixed(4)}`);
    }
  });

program
.command('migrate')
.description('Migrate project XML files and schema to the latest pxml syntax version')
.action(() => {
  const cwd = process.cwd();
  const projectXml = path.join(cwd, 'project.xml');
  if (!fs.existsSync(projectXml)) {
    console.error('project.xml not found. Run pxml init first.');
    process.exit(1);
  }
  const fileUrl = new URL(import.meta.url);
  const xsdSource = path.resolve(path.dirname(fileUrl.pathname), '../../pxml.xsd');
  const bugsXsdSource = path.resolve(path.dirname(fileUrl.pathname), '../../bugs.xsd');

  let updated = false;

  function findXmlFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        if (file === 'node_modules' || file === '.git' || file === '.pxml' || file === 'dist') {
          continue;
        }
        results.push(...findXmlFiles(filePath));
      } else if (file.endsWith('.xml')) {
        results.push(filePath);
      }
    }
    return results;
  }

  function updateXmlAttributes(content: string, tagName: string, updates: Record<string, string>): { content: string, updated: boolean } {
    const tagRegex = new RegExp(`<${tagName}\\s+([^>]*?)(\\/?)>`, 's');
    const match = content.match(tagRegex);
    if (!match) return { content, updated: false };

    const [fullTag, attrString, selfClosing] = match;
    const attrs: Record<string, string> = {};
    const attrRegex = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2] || attrMatch[3] || '';
    }

    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      if (attrs[key] !== value) {
        attrs[key] = value;
        changed = true;
      }
    }

    if (!changed) return { content, updated: false };

    const newAttrString = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n         ');

    const newTag = `<${tagName} ${newAttrString}${selfClosing ? ' /' : ''}>`;
    const startIndex = match.index!;
    const newContent = content.slice(0, startIndex) + newTag + content.slice(startIndex + fullTag.length);
    return { content: newContent, updated: true };
  }

  // 1. Scan and update all XML files in project
  const xmlFiles = findXmlFiles(cwd);
  for (const xmlFile of xmlFiles) {
    let content = fs.readFileSync(xmlFile, 'utf-8');
    let fileUpdated = false;

    const relDir = path.relative(path.dirname(xmlFile), cwd);
    
    if (content.includes('<project')) {
      const xsdPath = relDir ? path.join(relDir, 'pxml.xsd') : 'pxml.xsd';
      const updates: Record<string, string> = {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:noNamespaceSchemaLocation': xsdPath,
      };
      
      // Only set autogen-tests="true" if it wasn't already specified as false
      if (!content.includes('autogen-tests=')) {
        updates['autogen-tests'] = 'true';
      }

      const res = updateXmlAttributes(content, 'project', updates);
      if (res.updated) {
        content = res.content;
        fileUpdated = true;
      }
    } else if (content.includes('<bugs')) {
      const bugsXsdPath = relDir ? path.join(relDir, 'bugs.xsd') : 'bugs.xsd';
      const updates = {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:noNamespaceSchemaLocation': bugsXsdPath,
      };
      const res = updateXmlAttributes(content, 'bugs', updates);
      if (res.updated) {
        content = res.content;
        fileUpdated = true;
      }
    }

    if (fileUpdated) {
      fs.writeFileSync(xmlFile, content, 'utf-8');
      updated = true;
      console.log(`Updated XML schema references: ${path.relative(cwd, xmlFile)}`);
    }
  }

  // 2. Copy/update XSD schema files in the project root
  const rootProjectXml = path.join(cwd, 'project.xml');
  if (fs.existsSync(rootProjectXml)) {
    try {
      const mp = new PxmlParser();
      syncEditorSchema(cwd, mp.parse(rootProjectXml));
    } catch {
      // editor-schema sync is best-effort; never block migrate
    }
  }
  for (const [src, destName] of [[xsdSource, 'pxml.xsd'], [bugsXsdSource, 'bugs.xsd']]) {
    const dest = path.join(cwd, destName);
    const buf = fs.readFileSync(src);
    const existing = fs.existsSync(dest) ? fs.readFileSync(dest) : Buffer.alloc(0);
    if (!buf.equals(existing)) {
      fs.writeFileSync(dest, buf);
      updated = true;
      console.log(`Updated schema file: ${destName}`);
    }
  }

  if (updated) {
    console.log('Project files updated to latest syntax.');
  } else {
    console.log('Project is already up to date.');
  }
});

const pluginCmd = program
  .command('plugin')
  .description('Manage pxml packages/plugins');

pluginCmd
  .command('url-git <url>')
  .description('Clone a pxml package from a git URL into ./packages/<name> and wire its editor schema')
  .option('--name <name>', 'Override the target folder name under packages/')
  .option('--no-schema', 'Skip binding the package schema to .vscode/settings.json')
  .action((url: string, options: { name?: string; schema?: boolean }) => {
    const cwd = process.cwd();
    const seg = url.replace(/\.git$/, '').split(/[/:]/).pop() || 'package';
    const name = options.name || seg;
    const target = path.join(cwd, 'packages', name);

    if (fs.existsSync(target)) {
      console.error(`Package directory already exists: ${target}`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });

    console.log(`[PLUGIN] Cloning ${url} -> packages/${name} ...`);
    execSync(`git clone --depth 1 ${url} ${target}`, { stdio: 'inherit' });

    console.log(`[PLUGIN] Installed "${name}" to packages/${name}`);
    console.log(`Add to project.xml:`);
    console.log(`  <import package="${name}" from="packages/${name}" as="uix" />`);

    if (options.schema !== false) {
      const cat = path.join(target, 'catalog.xml');
      if (fs.existsSync(cat)) {
        const rel = path.relative(cwd, cat).split(path.sep).join('/');
        addCatalogToVscodeSettings(cwd, rel);
        console.log(`[PLUGIN] Editor schema bound (xml.catalogs -> ${rel})`);
      } else {
        console.log(`[PLUGIN] No catalog.xml in package; run \`pxml validate\` to auto-generate editor schema.`);
      }
    }
    console.log(`Then: pxml validate   # clones/generates enriched schema + autocomplete`);
    addPackageToManifest(cwd, name, url);
  });

program
.command('doctor')
  .description('Diagnostics checklist (configurations, env keys, databases)')
  .action(() => {
    console.log('--- Doctor Check ---');
    console.log(`[x] Node version: ${process.version}`);

    const projectXml = path.join(process.cwd(), 'project.xml');
    if (fs.existsSync(projectXml)) {
      console.log('[x] project.xml exists');
    } else {
      console.log('[ ] project.xml is missing');
    }

    if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
      console.log('[x] AI API Key (ANTHROPIC_API_KEY or OPENAI_API_KEY) is configured');
    } else {
      console.log('[ ] AI API Key is missing (needed for pxml compile/fix)');
    }
  });

program
  .command('install')
  .alias('i')
  .description('Install all packages listed in pxml.json (clones git repos into packages/)')
  .action(() => {
    const cwd = process.cwd();
    const count = installPackages(cwd);
    if (count > 0) {
      console.log(`\n[INSTALL] ${count} package(s) installed.`);
      console.log(`Now add <import> tags to project.xml and run: pxml validate`);
    }
  });

function buildBugContext(cwd: string): string {
  let ctx = '';
  const bugsHistoryPath = path.join(cwd, 'bugs_history.xml');
  if (fs.existsSync(bugsHistoryPath)) {
    try {
      const historyXml = fs.readFileSync(bugsHistoryPath, 'utf-8');
      const optionsXml = { ignoreAttributes: false, attributeNamePrefix: '@_', allowBooleanAttributes: true, parseAttributeValue: true };
      const fastXml = new XMLParser(optionsXml);
      const parsed = fastXml.parse(historyXml);
      if (parsed.bugs && parsed.bugs.bug) {
        const rawBugs = Array.isArray(parsed.bugs.bug) ? parsed.bugs.bug : [parsed.bugs.bug];
        let historyText = '\n--- Historical Bug Prevention Checklist ---\n';
        for (const bug of rawBugs) {
          const flowAttr = bug['@_flow'] || 'general';
          const desc = typeof bug === 'object' ? bug['#text'] || bug.description || '' : String(bug);
          historyText += `- [Flow: ${flowAttr}] Bug ID ${bug['@_id']}: ${desc.trim()}\n`;
        }
        ctx = historyText;
      }
    } catch {}
  }
  return ctx;
}

function injectHistoricalBugs(nodes: any[], cwd: string) {
  const bugsHistoryPath = path.join(cwd, 'bugs_history.xml');
  if (!fs.existsSync(bugsHistoryPath)) return;

  try {
    const historyXml = fs.readFileSync(bugsHistoryPath, 'utf-8');
    const optionsXml = {
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseAttributeValue: true,
    };
    const fastXml = new XMLParser(optionsXml);
    const parsed = fastXml.parse(historyXml);
    if (!parsed.bugs || !parsed.bugs.bug) return;

    const rawBugs = Array.isArray(parsed.bugs.bug) ? parsed.bugs.bug : [parsed.bugs.bug];
    for (const node of nodes) {
      for (const bug of rawBugs) {
        const bugId = bug['@_id'];
        const bugFlow = bug['@_flow'] || 'general';
        const bugDesc = (typeof bug === 'object' ? bug['#text'] || bug.description || '' : String(bug)).trim();

        const matchesFlow = bugFlow !== 'general' && (node.flow === bugFlow || node.id.includes(bugFlow));
        const hasExplicitLearned = node.constraints.some((c: any) => c.learnedFrom === bugId);

        if (matchesFlow || hasExplicitLearned) {
          const alreadyExists = node.constraints.some((c: any) => c.learnedFrom === bugId || c.description.includes(bugDesc));
          if (!alreadyExists) {
            node.constraints.push({
              verify: 'static',
              description: `Prevent regression of bug ${bugId}: ${bugDesc}`,
              learnedFrom: bugId
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[WARNING] Failed to parse bugs_history.xml: ${err.message}`);
  }
}

function calculateEstimatedCost(model: string, stats: { inputTokens: number; outputTokens: number; cachedTokens: number }): number {
  const modelLower = model.toLowerCase();
  let inputRate = 0.000003; // Default input rate per token ($3/M)
  let outputRate = 0.000015; // Default output rate per token ($15/M)
  let cacheReadRate = 0.0000003; // Default cache read rate ($0.30/M)

  if (modelLower.includes('gpt-4o-mini')) {
    inputRate = 0.00000015; // $0.15/M
    outputRate = 0.0000006; // $0.60/M
    cacheReadRate = 0.000000075;
  } else if (modelLower.includes('gpt-4o')) {
    inputRate = 0.000005; // $5/M
    outputRate = 0.000015; // $15/M
    cacheReadRate = 0.0000025;
  } else if (modelLower.includes('haiku')) {
    inputRate = 0.00000025; // $0.25/M
    outputRate = 0.00000125; // $1.25/M
    cacheReadRate = 0.00000003;
  } else if (modelLower.includes('sonnet')) {
    inputRate = 0.000003; // $3/M
    outputRate = 0.000015; // $15/M
    cacheReadRate = 0.0000003; // $0.30/M
  } else if (modelLower.includes('opus')) {
    inputRate = 0.000015; // $15/M
    outputRate = 0.000075; // $75/M
    cacheReadRate = 0.0000015;
  }

  const normalInput = Math.max(0, stats.inputTokens - stats.cachedTokens);
  const cost = (normalInput * inputRate) + (stats.cachedTokens * cacheReadRate) + (stats.outputTokens * outputRate);
  return cost;
}

program.parse(process.argv);
