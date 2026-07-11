import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  PxmlParser, validateProject, DependencyGraph, PxmlCodegen,
  addPackageToManifest, PxmlManifest, PxmlRunner, FileWriter, runFixLoop,
  createDefaultManifest,
} from '@two-tech-dev/pxml-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startStudio(port: number = 3001) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const staticDir = path.resolve(__dirname, '..', 'studio-static');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get(/^\/(?!api\/|ws).*/, (_req, res) => {
      const indexPath = path.join(staticDir, 'index.html');
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else res.status(404).send('Studio not built.');
    });
  }

  // WebSocket state
  const clients = new Set<WebSocket>();
  const MAX_HISTORY = 50;
  const messageHistory: string[] = [];
  let compileRunning = false;

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    if (compileRunning) {
      ws.send(JSON.stringify({ type: 'compile:resume', message: 'Compilation in progress...' }));
    }
    for (const item of messageHistory) {
      try { ws.send(item); } catch {}
    }
    ws.on('close', () => { clients.delete(ws); });
  });

  function broadcast(data: any) {
    const msg = JSON.stringify(data);
    if (msg.length < 5000) {
      messageHistory.push(msg);
      if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
    }
    for (const ws of clients) {
      try { ws.send(msg); } catch {}
    }
  }

  app.get('/api/home', (_req, res) => { res.json({ home: os.homedir() }); });

  app.post('/api/browse', (req, res) => {
    try {
      const { p: dirPath } = req.body as any;
      const target = dirPath || os.homedir();
      const entries = fs.readdirSync(target, { withFileTypes: true });
      const dirs: any[] = [];
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.')) continue;
        const full = path.join(target, e.name);
        dirs.push({ name: e.name, path: full, isPxml: fs.existsSync(path.join(full, 'project.xml')) });
      }
      dirs.sort((a: any, b: any) => a.name.localeCompare(b.name));
      res.json({ dirs, parent: path.dirname(target), current: target });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/project/open', (req, res) => {
    try {
      const { path: wp } = req.body as any;
      const project = new PxmlParser().parse(path.join(wp, 'project.xml'));
      const nodes = (project.nodes as any[]).map((n: any) => ({
        id: n.id,
        type: n.type || 'api-route',
        flow: n.flow || 'default',
        extends: n.extends,
        autogenTests: n.autogenTests !== false,
        meta: {
          path: n.meta?.path || '',
          depends_on: (n.meta?.depends_on || []) as string[],
        },
        input: (n.input || []).map((f: any) => ({
          name: f.name || '', type: f.type || 'string',
          required: f.required !== false, format: f.format,
        })),
        output: (n.output || []).map((f: any) => ({
          name: f.name || '', type: f.type || 'string',
          required: f.required !== false, format: f.format,
        })),
        constraints: (n.constraints || []).map((c: any) => ({
          verify: c.verify || 'static',
          description: typeof c === 'string' ? c : (c.description || ''),
          learnedFrom: c.learnedFrom,
        })),
        tests: (n.tests || []).map((t: any) => ({
          name: t.name || '',
          given: t.given || {},
          expect: t.expect || {},
        })),
      }));
      const imports = (project.imports || []).map((i: any) => ({
        src: i.src, package: i.package, from: i.from, as: i.as,
      }));
      res.json({
        nodes, imports,
        project: {
          name: project.name, stack: project.stack,
          version: project.version, autogenTests: project.autogenTests !== false,
        },
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/validate', (req, res) => {
    try {
      const { path: wp } = req.body as any;
      const project = new PxmlParser().parse(path.join(wp, 'project.xml'));
      try {
        validateProject(project.nodes as any);
        res.json({ valid: true, errors: [] });
      } catch (e: any) { res.json({ valid: false, errors: [e.message] }); }
    } catch (e: any) { res.json({ valid: false, errors: [e.message] }); }
  });

  app.post('/api/layout/save', (req, res) => {
    try {
      const { path: wp, positions } = req.body as any;
      const dir = path.join(wp, '.pxml');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'layout.json'), JSON.stringify({ positions }, null, 2));
      res.json({ ok: true });
    } catch (e: any) { res.json({ ok: false }); }
  });

  app.get('/api/layout/load', (req, res) => {
    try {
      const { path: wp } = req.query as any;
      const layoutPath = path.join(wp, '.pxml', 'layout.json');
      if (!fs.existsSync(layoutPath)) return res.json({ positions: {} });
      res.json(JSON.parse(fs.readFileSync(layoutPath, 'utf-8')));
    } catch (e: any) { res.json({ positions: {} }); }
  });

  app.post('/api/test', (req, res) => {
    try {
      const { path: wp, nodeId } = req.body as any;
      if (!wp) return res.json({ passed: false, message: 'No workspace path' });
      const project = new PxmlParser().parse(path.join(wp, 'project.xml'));
      const nodes = nodeId ? project.nodes.filter((n: any) => n.id === nodeId) : project.nodes;
      if (nodes.length === 0) return res.json({ passed: false, message: 'No matching nodes' });

      const testFiles: string[] = [];
      for (const node of nodes) {
        const testPath = path.join(wp, '.pxml', 'tests', `${node.id}.test.ts`);
        if (fs.existsSync(testPath)) testFiles.push(testPath);
      }
      if (testFiles.length === 0) return res.json({ passed: false, message: 'No test files found. Run compile first.' });

      try {
        execSync(`npx vitest run ${testFiles.join(' ')}`, { stdio: 'pipe', cwd: wp, timeout: 60000 });
        res.json({ passed: true, message: `All ${nodes.length} node(s) passed.` });
      } catch (e: any) {
        const stderr = e.stderr?.toString() || '';
        const failures = (stderr.match(/FAIL\s/g) || []).length;
        res.json({ passed: false, message: `${failures || 'Some'} test(s) failed. Check output.` });
      }
    } catch (e: any) { res.json({ passed: false, message: e.message }); }
  });

  app.post('/api/fix', async (req, res) => {
    try {
      const { path: wp, nodeId, provider, model, apiKey, baseUrl } = req.body as any;
      if (!wp || !nodeId) return res.json({ fixed: false, message: 'Missing workspace path or nodeId' });

      const project = new PxmlParser().parse(path.join(wp, 'project.xml'));
      const node = (project.nodes as any[]).find((n: any) => n.id === nodeId);
      if (!node) return res.json({ fixed: false, message: `Node ${nodeId} not found` });

      const actualProvider = provider || 'anthropic';
      const actualModel = model || 'claude-3-5-sonnet';
      const actualKey = apiKey || (actualProvider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
      const actualBaseUrl = baseUrl || '';

      const manifest = new PxmlManifest(wp, project.name, project.version);
      const writer = new FileWriter(false, wp);
      const runner = new PxmlRunner(wp, writer);

      const codegen = new PxmlCodegen({
        provider: actualProvider,
        apiKey: actualKey,
        baseUrl: actualBaseUrl,
        model: actualModel,
        cwd: wp,
      });

      // Collect bug context from bugs_history.xml
      let bugContext = '';
      const bugsPath = path.join(wp, 'bugs_history.xml');
      if (fs.existsSync(bugsPath)) {
        try {
          const xml = fs.readFileSync(bugsPath, 'utf-8');
          const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', allowBooleanAttributes: true, parseAttributeValue: true }).parse(xml);
          if (parsed.bugs && parsed.bugs.bug) {
            const rawBugs = Array.isArray(parsed.bugs.bug) ? parsed.bugs.bug : [parsed.bugs.bug];
            bugContext = rawBugs.map((b: any) =>
              `[${b['@_flow'] || 'general'}] ${b['@_id']}: ${(b['#text'] || '').trim()}`
            ).join('\n');
          }
        } catch {}
      }

      broadcast({ type: 'fix_start', nodeId });
      try {
        const testRes = runner.runNodeTests(node, project.stack);
        if (testRes.passed && !bugContext) {
          broadcast({ type: 'fix_end', nodeId, status: 'done', message: `Node ${nodeId} already healthy.` });
          return res.json({ fixed: true, message: `Node ${nodeId} tests already pass.` });
        }

        const success = await runFixLoop(
          node, wp, manifest, codegen, runner, writer,
          undefined, bugContext || undefined, !testRes.passed, project.stack,
        );

        broadcast({ type: 'fix_end', nodeId, status: success ? 'done' : 'error', message: success ? 'Fixed' : 'Could not fix' });
        res.json({ fixed: success, message: success ? `Node ${nodeId} fixed.` : `Could not fix node ${nodeId}.` });
      } catch (e: any) {
        broadcast({ type: 'fix_end', nodeId, status: 'error', message: e.message });
        res.json({ fixed: false, message: e.message });
      }
    } catch (e: any) { res.json({ fixed: false, message: e.message }); }
  });

  app.post('/api/diagnose', (req, res) => {
    try {
      const { path: wp } = req.body as any;
      const project = new PxmlParser().parse(path.join(wp, 'project.xml'));
      res.json({ diagnoses: project.nodes.map((n: any) => ({
        id: n.id, flow: n.flow || 'default',
        suspectedType: n.type || 'api-route', issues: [],
      }))});
    } catch (e: any) { res.json({ diagnoses: [] }); }
  });

  app.get('/api/bugs_history', (req, res) => {
    try {
      const { path: wp } = req.query as any;
      if (!wp) return res.json({ error: 'path required' });
      const bp = path.join(wp, 'bugs_history.xml');
      if (!fs.existsSync(bp)) return res.json({ bugs: [] });
      const xml = fs.readFileSync(bp, 'utf-8');
      const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
      const b = parsed?.bugs?.bug;
      const bugs = (Array.isArray(b) ? b : (b ? [b] : [])).map((x: any) => ({
        id: x['@_id'] || '', flow: x['@_flow'] || '', description: (x['#text'] || '').trim(),
      }));
      res.json({ bugs });
    } catch (e: any) { res.json({ bugs: [] }); }
  });

  app.get('/api/plugin/list', (req, res) => {
    try {
      const { path: wp } = req.query as any;
      if (!wp) return res.json({ packages: [] });
      const pkgDir = path.join(wp, 'packages');
      if (!fs.existsSync(pkgDir)) return res.json({ packages: [] });
      res.json({
        packages: fs.readdirSync(pkgDir, { withFileTypes: true })
          .filter((d: any) => d.isDirectory())
          .map((d: any) => ({ name: d.name, url: '', installed: true })),
      });
    } catch (e: any) { res.json({ packages: [] }); }
  });

  app.post('/api/plugin/add', (req, res) => {
    try {
      const { path: wp, url, name: pname } = req.body as any;
      if (!wp || !url) return res.json({ ok: false, message: 'path and url required' });
      const target = pname || url.split('/').pop()?.replace('.git', '') || 'plugin';
      const dest = path.join(wp, 'packages', target);
      if (!fs.existsSync(dest)) {
        execSync(`git clone ${url} ${dest}`, { stdio: 'pipe' });
      }
      addPackageToManifest(wp, target, url);
      res.json({ ok: true, name: target, url });
    } catch (e: any) { res.json({ ok: false, message: e.message }); }
  });

  app.post('/api/export', (req, res) => {
    try {
      const { path: wp, xml } = req.body as any;
      const dest = path.join(wp, '.pxml', 'export.xml');
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dest, xml, 'utf-8');
      res.json({ ok: true, path: dest });
    } catch (e: any) { res.json({ ok: false }); }
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

      fs.writeFileSync(path.join(projectDir, 'project.xml'), projectXml, 'utf-8');
      fs.writeFileSync(path.join(projectDir, 'packages', 'init-nextjs-project', 'project.xml'), initNextjsXml, 'utf-8');
      fs.writeFileSync(path.join(projectDir, 'bugs_history.xml'), bugsXml, 'utf-8');
      fs.writeFileSync(path.join(projectDir, 'pxml.json'), JSON.stringify({ version: '0.1.0', packages: {} }, null, 2), 'utf-8');
      fs.writeFileSync(path.join(projectDir, '.pxml', 'layout.json'), '{}', 'utf-8');

      // Copy XSD files from core
      try {
        const distDir = path.dirname(new URL(import.meta.url).pathname);
        const xsdSource = path.resolve(distDir, '..', 'pxml.xsd');
        const bugsXsdSrc = path.resolve(distDir, '..', 'bugs.xsd');
        if (fs.existsSync(xsdSource)) fs.copyFileSync(xsdSource, path.join(projectDir, 'pxml.xsd'));
        if (fs.existsSync(bugsXsdSrc)) fs.copyFileSync(bugsXsdSrc, path.join(projectDir, 'bugs.xsd'));
      } catch {}

      createDefaultManifest(projectDir);

      res.json({ ok: true, path: projectDir });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/console/exec', (req, res) => {
    try {
      const { command, cwd } = req.body as any;
      if (!command) return res.status(400).json({ error: 'command required' });
      const workDir = cwd || process.cwd();
      broadcast({ type: 'console:start', command, cwd: workDir });
      try {
        const output = execSync(command, { cwd: workDir, stdio: 'pipe', timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
        const stdout = output.toString();
        if (stdout) broadcast({ type: 'console:data', data: stdout });
        broadcast({ type: 'console:done', exitCode: 0, command });
        res.json({ ok: true, output: stdout });
      } catch (e: any) {
        const stderr = e.stderr?.toString() || '';
        const stdout = e.stdout?.toString() || '';
        if (stdout) broadcast({ type: 'console:data', data: stdout });
        if (stderr) broadcast({ type: 'console:data', data: stderr });
        broadcast({ type: 'console:done', exitCode: e.status || 1, command, error: true });
        res.json({ ok: false, output: stdout, error: stderr || e.message, exitCode: e.status || 1 });
      }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  server.listen(port, () => {
    console.log(`\x1b[1m\x1b[36m⧩ pxml Studio\x1b[0m  →  \x1b[4mhttp://localhost:${port}\x1b[0m`);
  });
}
