import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../parser/schema.js';

const NEOVIM_HELP = `.vim/pxml.lua`;

const SKIP_DIRS = new Set(['.pxml', 'node_modules', '.git', 'dist']);

/**
 * Walk all XML files under `dir` and return every distinct
 * ``xsi:noNamespaceSchemaLocation`` value found.
 */
function collectSchemaLocations(dir: string): string[] {
  const seen = new Set<string>();
  const walk = (d: string) => {
    let dirents: fs.Dirent[];
    try { dirents = fs.readdirSync(d, { withFileTypes: true }) as any; } catch { return; }
    for (const e of dirents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full);
      } else if (e.name.endsWith('.xml')) {
        try {
          const txt = fs.readFileSync(full, 'utf-8');
          const m = txt.match(/noNamespaceSchemaLocation="([^"]+)"/);
          if (m) seen.add(m[1]);
        } catch { /* skip unreadable */ }
      }
    }
  };
  walk(dir);
  return [...seen];
}

/**
 * Zero-config editor support for imported pxml packages.
 *
 * When a project imports a package via `from="github:owner/repo"` (cloned to
 * `.pxml/packages/github/...`) or via `from="packages/owner/repo"` (installed
 * locally, e.g. by `pxml plugin url-git`), this function derives an "enriched"
 * schema from the *actual* imported component nodes (enumerating their `flow`s
 * and `type`s) and wires it into the editor through an OASIS XML catalog +
 * VS Code `xml.catalogs` setting. The base `pxml.xsd` is remapped so every
 * `project.xml` referencing it also gets component-aware autocomplete.
 *
 * `flow`/`type`/`extends` use a union with `xs:string`, so values outside the
 * enumerated set still validate (no false errors) while editors still suggest
 * them. The exact `extends` values are enumerated using the user's import alias.
 */
export function addCatalogToVscodeSettings(cwd: string, relCatalogPath: string): void {
  const vscodeDir = path.join(cwd, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  const settingsPath = path.join(vscodeDir, 'settings.json');
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }
  const catalogs = Array.isArray(settings['xml.catalogs']) ? [...(settings['xml.catalogs'] as string[])] : [];
  // normalise separators so the path matches regardless of OS
  const norm = relCatalogPath.split(path.sep).join('/');
  if (!catalogs.includes(norm)) catalogs.push(norm);
  settings['xml.catalogs'] = catalogs;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

export function syncEditorSchema(cwd: string, project: Project): void {
  // The parser flattens and clears `imports`, so detect a package import from
  // the raw project.xml instead (github clone OR local `packages/...` install).
  const projXmlPath = path.join(cwd, 'project.xml');
  const raw = fs.existsSync(projXmlPath) ? fs.readFileSync(projXmlPath, 'utf-8') : '';
  const hasPackage = /from\s*=\s*["'](github:|packages\/)/.test(raw);
  if (!hasPackage) return;

  // Resolve ALL package import aliases so we can enumerate the EXACT
  // `extends` values (alias:category:component) for every imported package.
  const aliases: string[] = [];
  for (const el of raw.match(/<import\b[^>]*>/g) ?? []) {
    if (/from\s*=\s*["'](github:|packages\/)/.test(el)) {
      const am = el.match(/\bas\s*=\s*["']([^"']+)["']/);
      if (am && !aliases.includes(am[1])) aliases.push(am[1]);
    }
  }

  const flows = [...new Set(project.nodes.map(n => n.flow))].filter(Boolean).sort();
  const types = [...new Set(project.nodes.map(n => n.type))].filter(Boolean).sort();
  if (flows.length === 0) return;

  // Exact extendable base-component ids: those belonging to any imported
  // package (id starts with `<alias>:` and contains at least two colons).
  const extendsVals = aliases.length > 0
    ? [...new Set(
        project.nodes
          .map(n => n.id)
          .filter(id => aliases.some(a => id.startsWith(`${a}:`) && (id.match(/:/g) ?? []).length >= 2))
      )].sort()
    : [];

  const coreXsdPath = path.join(cwd, 'pxml.xsd');
  if (!fs.existsSync(coreXsdPath)) return; // nothing to remap against

  const pxmldir = path.join(cwd, '.pxml');
  const schemaDir = path.join(pxmldir, 'schemas');
  fs.mkdirSync(schemaDir, { recursive: true });

  const flowEnum = flows.map(f => `        <xs:enumeration value="${f}"/>`).join('\n');
  const typeEnum = types.map(t => `        <xs:enumeration value="${t}"/>`).join('\n');
  const extendsEnum = extendsVals.map(v => `        <xs:enumeration value="${v}"/>`).join('\n');

  const additions = `
  <xs:simpleType name="UiFlowType">
    <xs:union>
      <xs:simpleType><xs:restriction base="xs:string">
${flowEnum}
      </xs:restriction></xs:simpleType>
      <xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
    </xs:union>
  </xs:simpleType>
  <xs:simpleType name="UiNodeType">
    <xs:union>
      <xs:simpleType><xs:restriction base="xs:string">
${typeEnum}
      </xs:restriction></xs:simpleType>
      <xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
    </xs:union>
  </xs:simpleType>
${
  extendsVals.length
    ? `  <xs:simpleType name="UiExtendsType">
    <xs:union>
      <xs:simpleType><xs:restriction base="xs:string">
${extendsEnum}
      </xs:restriction></xs:simpleType>
      <xs:simpleType><xs:restriction base="xs:string"/></xs:simpleType>
    </xs:union>
  </xs:simpleType>
`
    : ''
}
`;

  let core = fs.readFileSync(coreXsdPath, 'utf-8');
  core = core.replace(
    '<xs:attribute name="flow" type="xs:string" use="required"/>',
    '<xs:attribute name="flow" type="UiFlowType" use="required"/>'
  );
  core = core.replace(
    '<xs:attribute name="type" type="xs:string" use="required"/>',
    '<xs:attribute name="type" type="UiNodeType" use="required"/>'
  );
  if (extendsVals.length) {
    core = core.replace(
      '<xs:attribute name="extends" type="xs:string" use="optional"/>',
      '<xs:attribute name="extends" type="UiExtendsType" use="optional"/>'
    );
  }
  core = core.replace('</xs:schema>', `${additions}</xs:schema>`);

  fs.writeFileSync(path.join(schemaDir, 'pxml.enriched.xsd'), core);

  // Collect every distinct noNamespaceSchemaLocation across the project so the
  // catalog remaps ALL of them (not just the root pxml.xsd).  This ensures
  // flow files (``../pxml.xsd``) and package files (``../../pxml.xsd``)
  // also benefit from the enriched schema.
  const schemaLocations = collectSchemaLocations(cwd);
  if (!schemaLocations.includes('pxml.xsd')) schemaLocations.unshift('pxml.xsd');
  const sysEntries = schemaLocations
    .map(loc => `  <system systemId="${loc}" uri="schemas/pxml.enriched.xsd"/>`)
    .join('\n');
  const catalog = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
${sysEntries}
</catalog>
`;
  fs.writeFileSync(path.join(pxmldir, 'catalog.xml'), catalog);

  addCatalogToVscodeSettings(cwd, '.pxml/catalog.xml');
  createNvimLspHelper(cwd);
}

function createNvimLspHelper(cwd: string): void {
  const vimDir = path.join(cwd, '.vim');
  fs.mkdirSync(vimDir, { recursive: true });
  const content = `-- pxml — XML catalog for lemminx (nvim-lspconfig)
-- Paste into your LSP config or source this file.
--
-- require'lspconfig'.lemminx.setup {
--   settings = {
--     xml = {
--       catalogs = { vim.fn.getcwd() .. "/.pxml/catalog.xml" }
--     }
--   }
-- }
--
-- coc.nvim (coc-xml) reads .vscode/settings.json automatically.
-- This file is auto-generated by pxml.
`;
  fs.writeFileSync(path.join(vimDir, 'pxml.lua'), content);
}

