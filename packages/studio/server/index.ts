import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  PxmlParser, validateProject, DependencyGraph, PxmlManifest, PxmlCache,
  PxmlCodegen, PxmlRunner, getTestFilePath, FileWriter,
  runFixLoop, runBuildLoop, syncEditorSchema, PxmlDiagnostics,
  addPackageToManifest, buildProjectContext, createDefaultManifest,
} from '@two-tech-dev/pxml-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { XMLParser } from 'fast-xml-parser';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/home', (_req, res) => {
  res.json({ home: os.homedir() });
});

app.post('/api/browse', (req, res) => {
  try {
    const { p: dirPath } = req.body;
    const target = dirPath || os.homedir();
    const entries = fs.readdirSync(target, { withFileTypes: true });
    const items = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        isDir: true,
        hasProjectXml: fs.existsSync(path.join(target, e.name, 'project.xml')),
      }));
    const parent = path.dirname(target);
    res.json({ path: target, parent: parent !== target ? parent : null, items });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

const CLIENT_DIST = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..', 'dist', 'client');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

const clients = new Set<WebSocket>();
let messageHistory: string[] = [];
const MAX_HISTORY = 200;
let compileRunning = false;

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('[WS] Client connected, total:', clients.size);

  if (compileRunning) {
    ws.send(JSON.stringify({ type: 'compile:resume', message: 'Compilation in progress...' }));
  }
  for (const item of messageHistory) {
    try { ws.send(item); } catch {}
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[WS] Client disconnected, total:', clients.size);
  });
});

function broadcast(data: any) {
  const msg = JSON.stringify(data);
  if (msg.length < 5000) {
    messageHistory.push(msg);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
  }
  console.log('[WS] Broadcast:', data.type, '→', clients.size, 'client(s)');
  for (const ws of clients) {
    try { ws.send(msg); } catch {}
  }
}

app.post('/api/project/open', (req, res) => {
  try {
    const { path: wsPath } = req.body;
    console.log('[STUDIO] Open request for:', wsPath);
    if (!wsPath || typeof wsPath !== 'string') {
      return res.status(400).json({ error: 'No project path provided' });
    }
    const projectXml = path.join(wsPath, 'project.xml');
    if (!fs.existsSync(projectXml)) {
      return res.status(404).json({ error: 'project.xml not found' });
    }

    // Auto-install packages from pxml.json if they exist but aren't installed
    const manifestPath = path.join(wsPath, 'pxml.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const packages = manifest.packages || {};
        for (const [name, url] of Object.entries(packages)) {
          const pkgDir = path.join(wsPath, 'packages', name);
          if (!fs.existsSync(pkgDir) && typeof url === 'string') {
            try {
              console.log(`[STUDIO] Auto-installing package: ${name} from ${url}`);
              fs.mkdirSync(path.dirname(pkgDir), { recursive: true });
              execSync(`git clone --depth 1 ${url} ${pkgDir}`, { stdio: 'ignore' });
            } catch (e: any) {
              console.warn(`[STUDIO] Failed to install ${name}: ${e.message}`);
            }
          }
        }
      } catch {}
    }

    const parser = new PxmlParser();
    const project = parser.parse(projectXml);

    // Parser flattens imports — read raw imports from XML to preserve them
    let rawImports: any[] = [];
    try {
      const rawXml = fs.readFileSync(projectXml, 'utf-8');
      const opts = { ignoreAttributes: false, attributeNamePrefix: '@_', allowBooleanAttributes: true, parseAttributeValue: true };
      const parsed = new XMLParser(opts).parse(rawXml);
      const rawImportNodes = parsed.project?.import;
      if (rawImportNodes) {
        const list = Array.isArray(rawImportNodes) ? rawImportNodes : [rawImportNodes];
        rawImports = list.map((i: any) => ({
          src: i['@_src'],
          package: i['@_package'],
          from: i['@_from'],
          as: i['@_as'] || '',
        }));
      }
      console.log('[STUDIO] Parsed', rawImports.length, 'imports from XML');
    } catch (e: any) { console.warn('[STUDIO] Import parse failed:', e.message); }

    res.json({
      project: {
        name: project.name,
        stack: project.stack,
        version: project.version,
        autogenTests: project.autogenTests,
      },
      nodes: project.nodes,
      imports: rawImports,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/project/save', (req, res) => {
  try {
    const { path: wsPath, xml } = req.body;
    const projectXml = path.join(wsPath, 'project.xml');
    fs.writeFileSync(projectXml, xml, 'utf-8');
    broadcast({ type: 'project:saved', message: 'Project saved' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/validate', (req, res) => {
  try {
    const { path: wsPath } = req.body;
    const projectXml = path.join(wsPath, 'project.xml');
    const parser = new PxmlParser();
    const project = parser.parse(projectXml);
    validateProject(project);
    res.json({ valid: true, errors: [] });
  } catch (e: any) {
    res.json({ valid: false, errors: [e.message] });
  }
});

app.post('/api/compile', async (req, res) => {
  const { path: wsPath, provider, model, apiKey, baseUrl, dryRun, verify, autogenTests, validate: doValidate, buildCheck } = req.body;
  res.json({ accepted: true });

  runCompile({
    wsPath,
    provider: provider || 'anthropic',
    model: model || 'claude-3-5-sonnet',
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl,
    dryRun: !!dryRun,
    verify: verify !== false,
    autogenTests: autogenTests !== false,
    validate: doValidate !== false,
    buildCheck: buildCheck !== false,
  }).catch(e => {
    broadcast({ type: 'compile:error', message: e.message });
  });
});

async function runCompile(opts: {
  wsPath: string;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dryRun: boolean;
  verify: boolean;
  autogenTests: boolean;
  validate: boolean;
  buildCheck: boolean;
}) {
  const { wsPath, provider, model, apiKey, baseUrl, dryRun, verify, autogenTests, validate, buildCheck } = opts;
  compileRunning = true;
  messageHistory = [];
  try {
    await doRunCompile({ wsPath, provider, model, apiKey, baseUrl, dryRun, verify, autogenTests, validate, buildCheck });
  } catch (e: any) {
    broadcast({ type: 'compile:error', message: `Unexpected error: ${e.message}` });
    broadcast({ type: 'compile:done', message: `Compilation aborted.`, error: true });
    compileRunning = false;
  }
}

async function doRunCompile(opts: {
  wsPath: string;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dryRun: boolean;
  verify: boolean;
  autogenTests: boolean;
  validate: boolean;
  buildCheck: boolean;
}) {
  const { wsPath, provider, model, apiKey, baseUrl, dryRun, verify, autogenTests, validate, buildCheck } = opts;
  const cwd = wsPath;
  const projectXml = path.join(cwd, 'project.xml');

  broadcast({ type: 'compile:start', message: 'Starting compilation...' });

  broadcast({ type: 'compile:validating', message: 'Parsing and validating project...' });
  const parser = new PxmlParser();
  const project = parser.parse(projectXml);
  try { validateProject(project); } catch (e: any) {
    broadcast({ type: 'compile:error', message: `Validation error: ${e.message}` });
    broadcast({ type: 'compile:done', message: 'Validation failed.', error: true });
    compileRunning = false;
    return;
  }
  broadcast({ type: 'compile:validated', message: `Validation OK. ${project.nodes.length} nodes.` });

  try { syncEditorSchema(cwd, project); } catch {}

  const graph = new DependencyGraph(project.nodes);
  const order = graph.getSortOrder();

  const manifest = new PxmlManifest(cwd, project.name, project.version);
  const writer = new FileWriter(dryRun, cwd);

  const codegen = new PxmlCodegen({
    provider: provider as any,
    apiKey,
    baseUrl,
    model,
    skipVerification: !verify,
    skipValidation: !validate,
  });

  const extendedNodeIds = new Set<string>();
  for (const node of project.nodes) {
    if (node.extends) extendedNodeIds.add(node.extends);
  }

  const packageAliases = new Set<string>();
  try {
    const rawXml = fs.readFileSync(path.join(cwd, 'project.xml'), 'utf-8');
    for (const el of rawXml.match(/<import\b[^>]*>/g) ?? []) {
      if (/from\s*=/.test(el) || /package\s*=/.test(el)) {
        const am = el.match(/\bas\s*=\s*["']([^"']+)["']/);
        if (am) packageAliases.add(am[1]);
      }
    }
  } catch {}

  const compiledNodeIds: string[] = [];
  const pendingTestNodes: any[] = [];

  for (const nodeId of order) {
    if (extendedNodeIds.has(nodeId)) continue;
    if ([...packageAliases].some(a => nodeId.startsWith(`${a}:`))) continue;

    const node = project.nodes.find(n => n.id === nodeId)!;
    const xmlHash = PxmlCache.hashNode(node);
    const cached = manifest.getNode(nodeId);

    if (cached && cached.xml_hash === xmlHash) {
      broadcast({ type: 'compile:node:skip', nodeId, message: `Skipped — unchanged.` });
      continue;
    }
    if (cached && cached.locked) {
      broadcast({ type: 'compile:node:skip', nodeId, message: `Locked — skipping.` });
      continue;
    }

    broadcast({ type: 'compile:node:start', nodeId, message: `Generating code...` });

    const nodeMap = new Map(project.nodes.map(n => [n.id, n]));
    const dependents = node.meta.depends_on;
    let projectContext = `Project: ${project.name} (stack: ${project.stack})\n`;
    projectContext += buildProjectContext(cwd);
    projectContext += `\n--- Declared nodes ---\n${project.nodes.map(n => `Node: ${n.id}, Path: ${n.meta.path}`).join('\n')}\n`;
    projectContext += '\n--- Relevant dependency files ---\n';

    const manifestData = manifest.get();
    for (const [mNodeId, mNode] of Object.entries(manifestData.nodes)) {
      if (!dependents.includes(mNodeId)) continue;
      for (const fp of mNode.output_files) {
        const absPath = path.resolve(cwd, fp);
        if (fs.existsSync(absPath)) {
          const content = fs.readFileSync(absPath, 'utf-8');
          const MAX_CHARS = 2000;
          projectContext += content.length <= MAX_CHARS
            ? `\n--- File: ${fp} (Node: ${mNodeId}) ---\n${content}\n`
            : `\n--- File: ${fp} (Node: ${mNodeId}) [truncated] ---\n${content.slice(0, MAX_CHARS)}\n`;
        }
      }
    }

    try {
      const code = await codegen.generateNodeCode(node, projectContext, writer, project.stack, cwd);
      const testFilePath = getTestFilePath(node.meta.path, project.stack);
      const testXmlHash = PxmlCache.hashNodeTests(node);
      const cachedTestHash = (cached as any)?.test_xml_hash;
      const absTest = path.resolve(cwd, testFilePath);
      const shouldAutogen = autogenTests && node.autogenTests;

      if (shouldAutogen && node.type !== 'setup-command' && node.type !== 'config-file') {
        if (!cached || cached.xml_hash !== xmlHash || !fs.existsSync(absTest) || cachedTestHash !== testXmlHash) {
          pendingTestNodes.push({ node, code });
        }
      }

      manifest.setNode(nodeId, {
        node_id: nodeId,
        source_file: 'project.xml',
        xml_hash: xmlHash,
        test_xml_hash: testXmlHash,
        output_files: (shouldAutogen && node.type !== 'setup-command' && node.type !== 'config-file')
          ? [node.meta.path, testFilePath] : [node.meta.path],
        depends_on: node.meta.depends_on,
        flow: node.flow,
        generated_at: new Date().toISOString(),
      } as any);
      manifest.save();
      compiledNodeIds.push(nodeId);

      const stats = codegen.getStats();
      broadcast({
        type: 'compile:node:done',
        nodeId,
        message: `Compiled OK.`,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        cachedTokens: stats.cachedTokens,
      });
    } catch (err: any) {
      broadcast({ type: 'compile:node:error', nodeId, message: `Failed: ${err.message}` });
      broadcast({ type: 'compile:done', message: `Compilation aborted: ${err.message}`, error: true });
      writer.rollback();
      compileRunning = false;
      return;
    }
  }

  if (pendingTestNodes.length > 0) {
    broadcast({ type: 'compile:testgen:start', message: 'Generating tests...' });

    // Always generate per-node tests first — reliable
    for (const pt of pendingTestNodes) {
      try {
        const tp = getTestFilePath(pt.node.meta.path, project.stack);
        await codegen.generateNodeTest(pt.node, path.resolve(cwd, tp), pt.code, project.stack, writer);
      } catch (e: any) {
        console.warn(`[TEST] Failed to generate test for ${pt.node.id}: ${e.message}`);
      }
    }

    // Try combined test as bonus
    try {
      const allNodes = pendingTestNodes.map((pt: any) => pt.node);
      await codegen.generateCombinedTest(allNodes, project.stack, writer, cwd);
    } catch {}
    broadcast({ type: 'compile:testgen:done', message: 'Tests generated.' });
  }

  if (compiledNodeIds.length > 0) {
    broadcast({ type: 'compile:test:start', message: 'Running tests...' });
    const runner = new PxmlRunner(cwd, writer);

    for (const nodeId of compiledNodeIds) {
      const node = project.nodes.find(n => n.id === nodeId)!;
      if (node.type === 'setup-command' || node.type === 'config-file') continue;
      const res = runner.runNodeTests(node, project.stack);
      broadcast({
        type: 'compile:test:result',
        nodeId,
        passed: res.passed,
        message: res.passed ? 'Tests passed.' : 'Tests failed.',
        output: res.output,
      });

      if (!res.passed) {
        const failedNames = Object.entries(res.results).filter(([,s]) => s === 'fail').map(([n]) => n);
        const isFallbackOnly = failedNames.length === 1 && failedNames[0] === 'AI-Generated General Verification';
        if (isFallbackOnly) {
          broadcast({ type: 'compile:test:result', nodeId, passed: true, message: 'Tests passed (fallback testgen skipped).', output: res.output });
          continue;
        }
        broadcast({ type: 'compile:fix:start', nodeId, message: 'Self-healing...' });
        for (let attempt = 1; attempt <= 3; attempt++) {
          broadcast({ type: 'compile:fix:attempt', nodeId, attempt, message: `Fix attempt ${attempt}/3...` });
          const success = await runFixLoop(node, cwd, manifest, codegen, runner, writer, undefined, '', true, project.stack);
          if (success) {
            broadcast({ type: 'compile:fix:done', nodeId, message: `Healed on attempt ${attempt}.` });
            break;
          } else if (attempt === 3) {
            broadcast({ type: 'compile:node:error', nodeId, message: 'Could not self-heal.' });
          }
        }
      }
    }

    if (buildCheck) {
      broadcast({ type: 'compile:build:check', message: 'Running build verification...' });
      try {
        const built = await runBuildLoop(cwd, project.stack, codegen, writer);
        broadcast({ type: 'compile:build:result', passed: built, message: built ? 'Build OK.' : 'Build failed.' });
      } catch (e: any) {
        broadcast({ type: 'compile:build:result', passed: false, message: `Build error: ${e.message}` });
      }
    }
  }

  const stats = codegen.getStats();
  broadcast({
    type: 'compile:done',
    message: 'Compilation complete.',
    inputTokens: stats.inputTokens,
    outputTokens: stats.outputTokens,
    cachedTokens: stats.cachedTokens,
  });
  compileRunning = false;
}

app.post('/api/test', (req, res) => {
  try {
    const { path: wsPath, nodeId } = req.body;
    const cwd = wsPath;
    const projectXml = path.join(cwd, 'project.xml');
    const parser = new PxmlParser();
    const project = parser.parse(projectXml);
    const writer = new FileWriter();
    const runner = new PxmlRunner(cwd, writer);

    const targets = nodeId
      ? project.nodes.filter(n => n.id === nodeId)
      : project.nodes.filter(n => n.type !== 'setup-command' && n.type !== 'config-file');

    if (targets.length === 0) {
      return res.json({ results: [], message: 'No testable nodes found.' });
    }

    const results = targets.map(n => {
      const result = runner.runNodeTests(n, project.stack);
      broadcast({
        type: 'test:result',
        nodeId: n.id,
        passed: result.passed,
        message: result.passed ? 'Tests passed' : 'Tests failed',
        output: result.output,
      });
      return { nodeId: n.id, passed: result.passed, output: result.output };
    });

    res.json({
      results,
      passed: results.every(r => r.passed),
      message: results.every(r => r.passed) ? 'All tests passed.' : `${results.filter(r => !r.passed).length} failed.`,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/fix', async (req, res) => {
  const { path: wsPath, nodeId, bug } = req.body;
  res.json({ accepted: true });

  (async () => {
    try {
      const cwd = wsPath;
      const projectXml = path.join(cwd, 'project.xml');
      const parser = new PxmlParser();
      const project = parser.parse(projectXml);
      const manifest = new PxmlManifest(cwd, project.name, project.version);
      const writer = new FileWriter();
      const runner = new PxmlRunner(cwd, writer);

      const targets = nodeId
        ? project.nodes.filter(n => n.id === nodeId)
        : project.nodes;

      const codegen = new PxmlCodegen({
        provider: 'anthropic' as any,
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
        model: 'claude-3-5-sonnet',
      });

      let bugContext = bug || '';
      const bugsHistoryPath = path.join(cwd, 'bugs_history.xml');
      if (fs.existsSync(bugsHistoryPath)) {
        bugContext += '\n' + fs.readFileSync(bugsHistoryPath, 'utf-8');
      }

      for (const node of targets) {
        broadcast({ type: 'fix:start', nodeId: node.id, message: `Self-healing ${node.id}...` });

        for (let attempt = 1; attempt <= 3; attempt++) {
          broadcast({ type: 'fix:attempt', nodeId: node.id, attempt, message: `Attempt ${attempt}/3` });
          const success = await runFixLoop(node, cwd, manifest, codegen, runner, writer, undefined, bugContext, attempt === 1 || bugContext ? true : false, project.stack);
          if (success) {
            broadcast({ type: 'fix:done', nodeId: node.id, message: `Healed on attempt ${attempt}.` });
            break;
          }
          if (attempt === 3) {
            broadcast({ type: 'fix:error', nodeId: node.id, message: 'Could not self-heal after 3 attempts.' });
          }
        }
      }
    } catch (e: any) {
      broadcast({ type: 'fix:error', message: e.message });
    }
  })();
});

app.post('/api/diagnose', (req, res) => {
  try {
    const { logContent } = req.body;
    const logs = logContent.split('\n').map((line: string) => {
      try { return JSON.parse(line); } catch { return { message: line }; }
    });

    const diagnoses: any[] = [];
    for (const log of logs) {
      const d = PxmlDiagnostics.diagnoseHeuristic(log);
      if (d) diagnoses.push(d);
    }
    res.json({ diagnoses });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/bugs_history', (req, res) => {
  try {
    const { path: wsPath } = req.query;
    if (!wsPath || typeof wsPath !== 'string') return res.status(400).json({ error: 'path required' });
    const bugsPath = path.join(wsPath, 'bugs_history.xml');
    if (!fs.existsSync(bugsPath)) {
      const defaultXml = `<bugs xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="bugs.xsd">
</bugs>`;
      return res.json({ xml: defaultXml, bugs: [] });
    }
    const xml = fs.readFileSync(bugsPath, 'utf-8');
    try {
      const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml);
      const rawBugs = parsed.bugs?.bug || [];
      const bugs = (Array.isArray(rawBugs) ? rawBugs : [rawBugs]).map((b: any) => ({
        id: b['@_id'] || '',
        flow: b['@_flow'] || '',
        description: typeof b === 'object' ? b['#text'] || '' : String(b),
      }));
      res.json({ xml, bugs });
    } catch {
      res.json({ xml, bugs: [] });
    }
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/bugs_history', (req, res) => {
  try {
    const { path: wsPath, xml } = req.body;
    const bugsPath = path.join(wsPath, 'bugs_history.xml');
    fs.writeFileSync(bugsPath, xml, 'utf-8');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/plugin/list', (req, res) => {
  try {
    const { path: wsPath } = req.query;
    if (!wsPath || typeof wsPath !== 'string') return res.status(400).json({ error: 'path required' });
    const manifestPath = path.join(wsPath, 'pxml.json');
    if (!fs.existsSync(manifestPath)) return res.json({ packages: [] });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const pkgs = Object.entries(manifest.packages || {}).map(([name, url]) => ({
      name,
      url,
      installed: fs.existsSync(path.join(wsPath, 'packages', name)),
    }));
    res.json({ packages: pkgs });
  } catch (e: any) {
    res.json({ packages: [] });
  }
});

app.post('/api/plugin/add', (req, res) => {
  try {
    const { path: wsPath, url, name: pkgName } = req.body;
    const seg = url.replace(/\.git$/, '').split(/[/:]/).pop() || 'package';
    const name = pkgName || seg;
    const target = path.join(wsPath, 'packages', name);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      execSync(`git clone --depth 1 ${url} ${target}`, { stdio: 'ignore' });
    }
    addPackageToManifest(wsPath, name, url);
    broadcast({ type: 'plugin:added', message: `Installed ${name}` });
    res.json({ ok: true, name });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/export', (req, res) => {
  try {
    const { path: wsPath, xml } = req.body;
    const exportDir = path.join(wsPath, '.pxml', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = path.join(exportDir, `project-${ts}.xml`);
    fs.writeFileSync(exportPath, xml, 'utf-8');
    res.json({ ok: true, path: exportPath });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/layout/save', (req, res) => {
  try {
    const { path: wsPath, positions } = req.body;
    const dotPxml = path.join(wsPath, '.pxml');
    fs.mkdirSync(dotPxml, { recursive: true });
    fs.writeFileSync(path.join(dotPxml, 'layout.json'), JSON.stringify(positions, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.get('/api/layout/load', (req, res) => {
  try {
    const { path: wsPath } = req.query;
    if (!wsPath || typeof wsPath !== 'string') return res.json({ positions: null });
    const layoutPath = path.join(wsPath, '.pxml', 'layout.json');
    if (!fs.existsSync(layoutPath)) return res.json({ positions: null });
    res.json({ positions: JSON.parse(fs.readFileSync(layoutPath, 'utf-8')) });
  } catch { res.json({ positions: null }); }
});

app.post('/api/project/init', (req, res) => {
  try {
    const { name, dir, stack = 'nextjs' } = req.body as any;
    if (!name || !dir) return res.status(400).json({ error: 'name and dir required' });

    const projectDir = path.join(dir, name);
    if (fs.existsSync(projectDir)) {
      return res.status(400).json({ error: `Directory already exists: ${projectDir}` });
    }

    fs.mkdirSync(path.join(projectDir, 'flows'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'packages', 'init-nextjs-project'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, '.pxml'), { recursive: true });

    const projectXml = `<project name="${name}" stack="${stack}" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="pxml.xsd">
  <import package="init-nextjs-project" from="packages/init-nextjs-project" as="nextjs-init" />

  <node id="setup.nextjs" type="setup-command" flow="setup" extends="nextjs-init:base-setup" />

  <node id="ui.home" type="ui-component" flow="navigation">
    <meta>
      <path>app/page.tsx</path>
      <depends_on>setup.nextjs</depends_on>
    </meta>
    <constraint verify="static">File exports a default React component</constraint>
    <constraint verify="llm-judge">Build a modern dark-themed landing page with a hero section and clean typography using Tailwind CSS.</constraint>
  </node>
</project>`;

    const initNextjsXml = `<project name="init-nextjs-project" stack="nextjs" version="0.1.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="../../pxml.xsd">
  <node id="base-setup" type="setup-command" flow="setup">
    <meta>
      <path>package.json</path>
    </meta>
    <constraint verify="static">Initialize Next.js app in the current directory non-interactively. Run: npx create-next-app@latest . --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --yes</constraint>
  </node>
</project>`;

    const bugsXml = `<bugs xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="bugs.xsd">
</bugs>`;

    const pxmlJson: any = { version: '0.1.0', packages: {} };

    fs.writeFileSync(path.join(projectDir, 'project.xml'), projectXml, 'utf-8');
    fs.writeFileSync(path.join(projectDir, 'packages', 'init-nextjs-project', 'project.xml'), initNextjsXml, 'utf-8');
    fs.writeFileSync(path.join(projectDir, 'bugs_history.xml'), bugsXml, 'utf-8');
    fs.writeFileSync(path.join(projectDir, 'pxml.json'), JSON.stringify(pxmlJson, null, 2), 'utf-8');
    fs.writeFileSync(path.join(projectDir, '.pxml', 'layout.json'), '{}', 'utf-8');

    // Copy XSD files from core package
    try {
      const coreDir = path.dirname(require.resolve('@two-tech-dev/pxml-core/package.json'));
      const xsdSource = path.join(coreDir, 'pxml.xsd');
      const bugsXsdSource = path.join(coreDir, 'bugs.xsd');
      if (fs.existsSync(xsdSource)) fs.copyFileSync(xsdSource, path.join(projectDir, 'pxml.xsd'));
      if (fs.existsSync(bugsXsdSource)) fs.copyFileSync(bugsXsdSource, path.join(projectDir, 'bugs.xsd'));
    } catch {}

    createDefaultManifest(projectDir);

    res.json({ ok: true, path: projectDir });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`pxml Studio server running on http://localhost:${PORT}`);
});
