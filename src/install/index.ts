import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { addCatalogToVscodeSettings, syncEditorSchema } from '../editor-schema/index.js';
import { PxmlParser } from '../parser/index.js';

const MANIFEST = 'pxml.json';

export interface PxmManifest {
  pxml: string;
  packages: Record<string, string>;  // name -> git URL
}

export function readPxmlManifest(cwd: string): PxmManifest | null {
  const fp = path.join(cwd, MANIFEST);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

export function writePxmlManifest(cwd: string, m: PxmManifest): void {
  fs.writeFileSync(
    path.join(cwd, MANIFEST),
    JSON.stringify(m, null, 2) + '\n'
  );
}

export function addPackageToManifest(cwd: string, name: string, url: string): void {
  const m = readPxmlManifest(cwd) ?? { pxml: '', packages: {} };
  m.packages[name] = url;
  writePxmlManifest(cwd, m);
}

export function removePackageFromManifest(cwd: string, name: string): void {
  const m = readPxmlManifest(cwd);
  if (!m) return;
  delete m.packages[name];
  writePxmlManifest(cwd, m);
}

export function getCurrentPxmlVersion(): string {
  // resolve package.json relative to this source file (../../package.json)
  const pj = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..', '..', 'package.json'
  );
  try {
    return JSON.parse(fs.readFileSync(pj, 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function createDefaultManifest(cwd: string): void {
  if (readPxmlManifest(cwd)) return; // already exists
  writePxmlManifest(cwd, {
    pxml: getCurrentPxmlVersion(),
    packages: {}
  });
}

export function installPackages(cwd: string): number {
  const m = readPxmlManifest(cwd);
  if (!m) {
    console.log(`[INSTALL] No ${MANIFEST} found. Create one with "pxml init" or manually.`);
    return 0;
  }

  const entries = Object.entries(m.packages);
  if (entries.length === 0) {
    console.log(`[INSTALL] ${MANIFEST} has no packages to install.`);
    return 0;
  }

  let count = 0;
  for (const [name, url] of entries) {
    const target = path.join(cwd, 'packages', name);
    if (fs.existsSync(target)) {
      console.log(`[INSTALL] ${name} already installed at packages/${name}, skipping.`);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    console.log(`[INSTALL] Installing ${name} from ${url}...`);
    execSync(`git clone --depth 1 ${url} ${target}`, { stdio: 'inherit' });
    console.log(`[INSTALL] ${name} -> packages/${name}`);

    // bind schema if the package ships a catalog
    const cat = path.join(target, 'catalog.xml');
    if (fs.existsSync(cat)) {
      const rel = path.relative(cwd, cat).split(path.sep).join('/');
      addCatalogToVscodeSettings(cwd, rel);
      console.log(`[INSTALL] Schema catalog bound (${rel})`);
    }
    count++;
  }
  // sync editor schema after all packages installed
  try {
    const parser = new PxmlParser();
    const proj = parser.parse(path.join(cwd, 'project.xml'));
    syncEditorSchema(cwd, proj);
  } catch {
    // best-effort; editor schema will sync on next pxml validate
  }
  return count;
}
