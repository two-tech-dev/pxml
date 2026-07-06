#!/usr/bin/env node
import { Command } from 'commander';
import { PxmlParser } from '../parser/index.js';
import { DependencyGraph } from '../graph/index.js';
import { PxmlManifest } from '../manifest/index.js';
import { PxmlCache } from '../cache/index.js';
import { PxmlCodegen } from '../codegen/index.js';
import { PxmlRunner } from '../runner/index.js';
import { FileWriter } from '../writer/index.js';
import { runFixLoop } from './fix.js';
import { execSync } from 'child_process';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

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

    // Create example directory structure for flows
    fs.mkdirSync(path.join(cwd, 'flows'), { recursive: true });
    fs.mkdirSync(path.join(cwd, 'shared'), { recursive: true });

    const mainXml = `<project name="my-app" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="pxml.xsd">
  <import src="./flows/blog.xml" as="blog" />

  <node id="setup.nextjs" type="setup-command" flow="setup">
    <meta>
      <path>package.json</path>
    </meta>
    <constraint verify="static">Initialize Next.js app in the current directory non-interactively. Run: npx create-next-app@latest . --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --yes && npm install better-sqlite3 && npm install --save-dev @types/better-sqlite3</constraint>
  </node>

  <node id="ui.home" type="ui-component" flow="navigation">
    <meta>
      <path>app/page.tsx</path>
      <depends_on>setup.nextjs</depends_on>
    </meta>
    <constraint verify="static">Replace the entire homepage with a beautifully styled landing page (clean dark theme, tailwind classes). Do not call any dashboard APIs like /api/network or /api/ram. Show a hero section, and a prominent link/button pointing to the Posts page at '/posts'.</constraint>
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
    <constraint verify="static">Initialize a better-sqlite3 database named 'blog.db'. Create a 'posts' table with columns id (INTEGER PRIMARY KEY), title (TEXT), and content (TEXT) if it does not exist. Implement both POST (to insert a post) and GET (to select all posts) handlers in this route file.</constraint>
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

    const bugsHistoryXml = `<bugs>
  <bug id="db.locking" flow="blog.write">
    SQLite database file locks when executing parallel write operations. Ensure connections are closed properly or run db queries sequentially.
  </bug>
</bugs>`;

    fs.writeFileSync(configPath, mainXml, 'utf-8');
    fs.writeFileSync(path.join(cwd, 'flows', 'blog.xml'), blogXml, 'utf-8');
    fs.writeFileSync(path.join(cwd, 'bugs_history.xml'), bugsHistoryXml, 'utf-8');
    console.log('Successfully initialized Next.js project with pxml templates.');
  });

program
  .command('compile')
  .description('Compile XML nodes to implementation code')
  .option('--dry-run', 'Show execution plan without writing changes')
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
    const graph = new DependencyGraph(project.nodes);
    const order = graph.getSortOrder();

    const manifest = new PxmlManifest(cwd, project.name, project.version);
    const writer = new FileWriter(!!options.dryRun);

    const apiKey = options.apiKey || (options.provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);

    const codegen = new PxmlCodegen({
      provider: options.provider as any,
      apiKey: apiKey,
      baseUrl: options.baseUrl,
      model: options.model
    });

    console.log(`Compiling project ${project.name} (stack: ${project.stack})...`);

    for (const nodeId of order) {
      const node = project.nodes.find(n => n.id === nodeId)!;
      const xmlHash = PxmlCache.hashNode(node);
      const cached = manifest.getNode(nodeId);

      if (cached && cached.xml_hash === xmlHash) {
        console.log(`[SKIP] Node ${nodeId} has not changed.`);
        continue;
      }

      if (cached && cached.locked) {
        console.log(`[LOCKED] Node ${nodeId} is locked. Skipping codegen.`);
        continue;
      }

      // Build rich project context by loading contents of already generated files
      let projectContext = project.nodes.map(n => `Node: ${n.id}, Path: ${n.meta.path}`).join('\n');
      projectContext += '\n\nAlready generated files contents:\n';
      
      const manifestData = manifest.get();
      for (const [mNodeId, mNode] of Object.entries(manifestData.nodes)) {
        for (const filePath of mNode.output_files) {
          const absPath = path.resolve(cwd, filePath);
          if (fs.existsSync(absPath)) {
            const content = fs.readFileSync(absPath, 'utf-8');
            projectContext += `\n--- File: ${filePath} (Node: ${mNodeId}) ---\n${content}\n`;
          }
        }
      }

      console.log(`[CODEGEN] Generating code for node: ${nodeId}`);
      try {
        await codegen.generateNodeCode(node, projectContext, writer);
        
        manifest.setNode(nodeId, {
          node_id: nodeId,
          source_file: 'project.xml', // Simplify for this phase
          xml_hash: xmlHash,
          output_files: [node.meta.path],
          depends_on: node.meta.depends_on,
          flow: node.flow,
          generated_at: new Date().toISOString()
        });
        manifest.save();
      } catch (err: any) {
        console.error(`[ERROR] Failed to compile node ${nodeId}: ${err.message}`);
        writer.rollback();
        process.exit(1);
      }
    }

    console.log('Compilation finished successfully.');
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
      const res = runner.runNodeTests(node);
      
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
      const testRes = runner.runNodeTests(node);
      if (!testRes.passed || bugContext) {
        // If bugContext is provided, force run at least once by passing a flag or bypassing check
        const success = await runFixLoop(node, cwd, manifest, codegen, runner, writer, undefined, bugContext, !!bugContext);
        if (success) {
          console.log(`[FIX] Node ${node.id} healed successfully.`);
        } else {
          console.error(`[FIX] Could not self-heal node ${node.id}.`);
        }
      } else {
        console.log(`[FIX] Node ${node.id} is healthy.`);
      }
    }
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

program.parse(process.argv);
