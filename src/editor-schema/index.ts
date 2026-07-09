import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../parser/schema.js';

/**
 * Zero-config editor support for git-imported pxml packages.
 *
 * When a project imports a package via `from="github:owner/repo"`, pxml clones
 * it under `.pxml/packages/github/...`. This function derives an "enriched"
 * schema from the *actual* cloned component nodes (enumerating their `flow`s
 * and `type`s) and wires it into the editor through an OASIS XML catalog +
 * VS Code `xml.catalogs` setting. The base `pxml.xsd` is remapped so every
 * `project.xml` referencing it also gets component-aware autocomplete.
 *
 * `flow`/`type` use a union with `xs:string`, so values outside the enumerated
 * set still validate (no false errors) while editors still suggest them.
 */
export function syncEditorSchema(cwd: string, project: Project): void {
  // The parser flattens and clears `imports`, so detect a github import from
  // the raw project.xml instead (the package is cloned under .pxml/packages/github).
  const projXmlPath = path.join(cwd, 'project.xml');
  const raw = fs.existsSync(projXmlPath) ? fs.readFileSync(projXmlPath, 'utf-8') : '';
  const hasGithub = /from\s*=\s*["']github:/.test(raw);
  if (!hasGithub) return;

  // Resolve the user's import alias (e.g. `as="uix"`) so we can enumerate the
  // EXACT `extends` values (alias:category:component) the editor should suggest.
  let alias: string | null = null;
  for (const el of raw.match(/<import\b[^>]*>/g) ?? []) {
    if (/from\s*=\s*["']github:/.test(el)) {
      const am = el.match(/\bas\s*=\s*["']([^"']+)["']/);
      if (am) { alias = am[1]; break; }
    }
  }

  const flows = [...new Set(project.nodes.map(n => n.flow))].filter(Boolean).sort();
  const types = [...new Set(project.nodes.map(n => n.type))].filter(Boolean).sort();
  if (flows.length === 0) return;

  // Exact extendable base-component ids: those belonging to the imported
  // package (id starts with `<alias>:` and contains at least two colons).
  const extendsVals = alias
    ? [...new Set(
        project.nodes
          .map(n => n.id)
          .filter(id => id.startsWith(`${alias}:`) && (id.match(/:/g) ?? []).length >= 2)
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

  const catalog = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
  <system systemId="pxml.xsd" uri="schemas/pxml.enriched.xsd"/>
</catalog>
`;
  fs.writeFileSync(path.join(pxmldir, 'catalog.xml'), catalog);

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
  if (!catalogs.includes('.pxml/catalog.xml')) catalogs.push('.pxml/catalog.xml');
  settings['xml.catalogs'] = catalogs;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}
