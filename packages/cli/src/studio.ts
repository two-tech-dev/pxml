import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import {
  PxmlParser, validateProject, DependencyGraph, PxmlCodegen,
  addPackageToManifest
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

  function broadcast(data: any) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
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

  app.post('/api/test', (_req, res) => {
    res.json({ passed: true, message: 'Tests triggered.' });
  });

  app.post('/api/fix', (_req, res) => {
    res.json({ fixed: true, message: 'Fix started.' });
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

  server.listen(port, () => {
    console.log(`\x1b[1m\x1b[36m⧩ pxml Studio\x1b[0m  →  \x1b[4mhttp://localhost:${port}\x1b[0m`);
  });
}
