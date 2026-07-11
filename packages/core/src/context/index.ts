import * as fs from 'fs';
import * as path from 'path';

export function buildProjectContext(cwd: string): string {
  let ctx = '';

  const exists = (rel: string) => fs.existsSync(path.join(cwd, rel));
  const read = (rel: string) => fs.readFileSync(path.join(cwd, rel), 'utf-8') || '';
  const trunc = (s: string, n: number) => s.length <= n ? s : s.slice(0, n) + '\n... [truncated]';

  if (exists('package.json')) {
    try {
      const pkg = JSON.parse(read('package.json'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depList = Object.keys(deps || {}).slice(0, 20).join(', ');
      ctx += `Project package: ${pkg.name || 'unnamed'}\n`;
      ctx += `Dependencies: ${depList}\n\n`;
    } catch {}
  }

  const pages: string[] = [];
  function scan(dir: string, depth = 0) {
    if (depth > 3) return;
    const abs = path.join(cwd, dir);
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        if (entry.name === 'api') continue; // skip API routes, too many
        scan(path.join(dir, entry.name), depth + 1);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.includes('.test.')) {
        pages.push(path.join(dir, entry.name));
      }
    }
  }
  scan('app');
  scan('pages');
  scan('components');

  const pageList = pages.slice(0, 30).map(p => `  ${p}`).join('\n');
  ctx += `Existing files (${pages.length} total, showing first 30):\n${pageList}\n\n`;

  const keyFiles = [
    'app/layout.tsx', 'app/page.tsx', 'pages/_app.tsx', 'pages/index.tsx',
    'tailwind.config.ts', 'tailwind.config.js', 'tsconfig.json',
  ];
  for (const kf of keyFiles) {
    if (exists(kf)) {
      const content = read(kf);
      ctx += `--- ${kf} ---\n${trunc(content, 1200)}\n\n`;
    }
  }

  return ctx;
}
