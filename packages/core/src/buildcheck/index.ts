import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PxmlPatcher } from '../patcher/index.js';
import { PxmlCodegen } from '../codegen/index.js';
import { FileWriter } from '../writer/index.js';

const colors = {
  red: (t: string) => `\x1b[31m${t}\x1b[0m`,
  green: (t: string) => `\x1b[32m${t}\x1b[0m`,
  yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
  bold: (t: string) => `\x1b[1m${t}\x1b[0m`
};

export interface BuildResult {
  ok: boolean;
  raw: string;
}

// Run the stack's full build command.  This is the strongest oracle: it catches
// framework rules (Next.js 'use client'), module resolution, type errors, and
// cross-file issues that per-file tsc cannot.
export function runBuild(cwd: string, stack = 'nextjs'): BuildResult {
  const s = stack.toLowerCase();
  let cmd = 'npx next build';
  if (s.includes('go')) cmd = 'go build ./...';
  else if (s.includes('rust')) cmd = 'cargo build';
  else if (s.includes('python')) return { ok: true, raw: '' }; // py_compile is per-file
  else if (!(s.includes('next') || s.includes('ts') || s.includes('js'))) cmd = 'npx next build';

  try {
    execSync(cmd, { cwd, stdio: 'pipe', timeout: 600000 });
    return { ok: true, raw: '' };
  } catch (e: any) {
    const raw =
      (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
    return { ok: false, raw };
  }
}

// Post-codegen build verification + auto-fix loop.  Runs the build, feeds the
// full error output to the model as ONE patch request (covers all files at once),
// applies the patches, and rebuilds.  Bounded retries.
export async function runBuildLoop(
  cwd: string,
  stack: string,
  codegen: PxmlCodegen,
  writer: FileWriter,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = runBuild(cwd, stack);
    if (res.ok) {
      console.log(`${colors.green(colors.bold('[BUILD]'))} Project builds successfully.`);
      return true;
    }

    console.log(`${colors.yellow(colors.bold('[BUILD]'))} Build failed (attempt ${attempt}/${maxRetries}), auto-fixing...`);

    const prompt = `The project failed to build. Below are the build errors. Fix ALL errors by editing the affected files.
${res.raw.slice(0, 6000)}

Use SEARCH/REPLACE patch blocks. Prefix each file with "FILE: <relative_path>".
- If an error is caused by a MISSING DEPENDENCY (a package that is not installed), reply with the exact word NODEP and nothing else.
- Otherwise output only the patches.`;

    try {
      const patch = await codegen.generateDirect(
        prompt,
        'Generate SEARCH/REPLACE patches for the build errors, or the word NODEP if a dependency is missing.'
      );

      if (patch.trim().toUpperCase() === 'NODEP') {
        console.log(`${colors.yellow('[BUILD]')} Missing dependency detected, stopping build auto-fix.`);
        return false;
      }

      const filePatches = patch.split(/FILE:\s+/);
      let applied = 0;
      for (const fp of filePatches) {
        if (!fp.trim()) continue;
        const nl = fp.indexOf('\n');
        if (nl === -1) continue;
        const rel = fp.slice(0, nl).trim();
        const abs = path.resolve(cwd, rel);
        if (!fs.existsSync(abs)) continue;
        const content = fs.readFileSync(abs, 'utf-8');
        try {
          const patched = PxmlPatcher.applyPatch(content, fp.slice(nl + 1));
          writer.write(abs, patched);
          applied++;
        } catch (err: any) {
          console.warn(`${colors.red('[BUILD]')} Failed to apply patch to ${rel}: ${err.message}`);
        }
      }

      if (applied === 0) {
        console.log(`${colors.red('[BUILD]')} No patches applied, stopping.`);
        return false;
      }
      console.log(`${colors.green('[BUILD]')} Applied ${applied} patch(es), rebuilding...`);
    } catch (err: any) {
      console.warn(`${colors.red('[BUILD]')} fix attempt failed: ${err.message}`);
      return false;
    }
  }
  return false;
}
