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

// Copy a package's compiled component files (components/ui/**) into the project
// so that `import X from '@/components/ui/...'` resolves.  Existing project files
// are preserved so user overrides are never clobbered.  Returns # of files copied.
export function syncPackageComponents(cwd: string, pkgDir: string): number {
  const src = path.join(pkgDir, 'components', 'ui');
  if (!fs.existsSync(src)) return 0;
  const dest = path.join(cwd, 'components', 'ui');
  let count = 0;

  const walk = (rel: string) => {
    const sdir = path.join(src, rel);
    for (const entry of fs.readdirSync(sdir, { withFileTypes: true })) {
      const childRel = rel ? path.join(rel, entry.name) : entry.name;
      const sPath = path.join(src, childRel);
      const dPath = path.join(dest, childRel);
      if (entry.isDirectory()) {
        walk(childRel);
      } else {
        if (fs.existsSync(dPath)) continue; // preserve existing override
        fs.mkdirSync(path.dirname(dPath), { recursive: true });
        fs.copyFileSync(sPath, dPath);
        count++;
      }
    }
  };
  walk('');
  return count;
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
    const alreadyInstalled = fs.existsSync(target);
    if (alreadyInstalled) {
      console.log(`[INSTALL] ${name} already installed at packages/${name}, updating...`);
      try {
        execSync(`git -C ${target} pull --ff-only --depth 1`, { stdio: 'ignore' });
      } catch {
        // best-effort; proceed with whatever is on disk
      }
    } else {
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

    // Copy the package's real component .tsx files into the project so that
    // imports like `@/components/ui/layout/Container` resolve (the package ships
    // XML specs + compiled .tsx; the AI imports the .tsx via the '@/' alias).
    // Existing files in the project are preserved (do not clobber overrides).
    const n = syncPackageComponents(cwd, target);
    if (n > 0) console.log(`[INSTALL] Synced ${n} component file(s) from ${name} into components/ui/`);
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
