import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Node } from '../parser/schema.js';

export interface ValidationResult {
  ok: boolean;
  errors: string; // errors scoped to this node's file(s)
  raw: string; // full checker output
}

// Run the stack-appropriate syntax/type checker on a single node's file and
// return only the errors that belong to that file.  The checker is the oracle
// (deterministic), so this works regardless of model quality.
export function validateNode(node: Node, cwd: string, stack = 'nextjs'): ValidationResult {
  const file = node.meta.path;
  const abs = path.resolve(cwd, file);
  if (!fs.existsSync(abs)) {
    return { ok: true, errors: '', raw: '' };
  }

  const stackLower = stack.toLowerCase();
  let cmd = '';
  if (stackLower.includes('python')) {
    cmd = `python -m py_compile "${file}"`;
  } else if (stackLower.includes('go')) {
    cmd = `go vet "./${path.dirname(file)}"`;
  } else if (stackLower.includes('rust')) {
    cmd = `cargo check --message-format short 2>&1 | grep "${file}"`;
  } else {
    // TS / JS / Next.js: prefer the project's local tsc, fall back to npx.
    const localTsc = path.join(cwd, 'node_modules', '.bin', 'tsc');
    const tscBin = fs.existsSync(localTsc) ? `"${localTsc}"` : 'npx tsc';
    cmd = `${tscBin} --noEmit`;
  }

  let raw = '';
  try {
    execSync(cmd, { cwd, stdio: 'pipe' });
    return { ok: true, errors: '', raw: '' };
  } catch (e: any) {
    raw =
      (e.stdout ? e.stdout.toString() : '') +
      (e.stderr ? e.stderr.toString() : '');
  }

  // Scope errors to this node's file.  tsc prints "<relpath>(line,col): error ...".
  const lines = raw.split('\n');
  const rel = file;
  const base = path.basename(file);
  const errLines = lines.filter(l => l.includes(rel) || l.includes(base));
  const errors = errLines.join('\n').trim();
  return { ok: errors.length === 0, errors, raw };
}
