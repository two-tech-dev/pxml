const SHARED = `IMPORT & STRUCTURE RULES (CRITICAL):
- Only import from: (a) standard npm packages, (b) the project '@/' alias for files declared as nodes, (c) RELATIVE paths to other files in this project.
- The installed UI library lives at '@/components/ui/...' (real files from pxml install). Import these directly — they exist on disk. Do NOT import from a bare package name (e.g. 'ui-ux-components-pxml').
- For EXTENDS nodes: prefer importing '@@/components/ui/...' matching components over re-implementing.`;

const DATABASE = `DATABASE CONVENTION:
- DB node exposes: \`db\` instance + \`run(sql, params?)\`, \`all(sql, params?)\`, \`get(sql, params?)\`, \`exec(sql)\` wrappers.
- Other nodes import \`db\` from the db-helper node and call ONLY these wrappers — never raw library methods.
- For prepared-statement engines: SPREAD params (e.g. \`db.prepare(sql).run(...(params ?? []))\`).`;

const API = `API RESPONSE CONVENTION:
- LIST endpoint returns the collection as root JSON array: \`NextResponse.json(products)\`.
- SINGLE endpoint returns the object directly: \`NextResponse.json(product)\`.
- No wrapping in \`{ data: [...] }\`.`;

const REACT = `REACT/CLIENT CONVENTION (Next.js App Router):
- Any component using hooks, browser APIs, or DOM events MUST have \`'use client'\` as the VERY FIRST line.
- Server-only files (route handlers, pure server components) must NOT use hooks.`;

export const IMPORT_RULES = [SHARED, DATABASE, API, REACT].join('\n\n');

export const IMPORT_RULES_BRIEF = `IMPORT: use '@/components/ui/...' for installed UI, relative paths for project nodes, ESM import syntax. Never bare package names.`;

export const IMPORT_RULES_TS = `${SHARED}\n\n${DATABASE}\n\n${API}\n\n${REACT}`;

export const IMPORT_RULES_PYTHON = `${SHARED}\n\n${DATABASE}

PYTHON CONVENTIONS:
- Use relative imports: \`from .module import ...\` for project files.
- Use standard \`import\` for third-party packages.
- For API endpoints, prefer FastAPI or Flask patterns.`;

export const IMPORT_RULES_GO = `${SHARED}\n\n${DATABASE}

GO CONVENTIONS:
- Package declaration must match directory.
- Use \`go mod\` for dependency management.
- Export only capitalized symbols.`;

export function getImportRules(stack: string): string {
  const s = stack.toLowerCase();
  if (s.includes('python')) return IMPORT_RULES_PYTHON;
  if (s.includes('go') || s === 'golang') return IMPORT_RULES_GO;
  return IMPORT_RULES_TS;
}
