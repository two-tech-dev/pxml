import { Node } from '../parser/schema.js';
import { PxmlCodegen } from '../codegen/index.js';
import { PxmlRunner, getTestFilePath } from '../runner/index.js';
import { PxmlPatcher } from '../patcher/index.js';
import { FileWriter } from '../writer/index.js';
import { PxmlManifest } from '../manifest/index.js';
import { fixLoopPrompt, FIX_LOOP_SYSTEM, getImportRules } from '@two-tech-dev/pxml-prompts';
import * as fs from 'fs';
import * as path from 'path';

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`
};

export async function runFixLoop(
  node: Node,
  projectDir: string,
  manifest: PxmlManifest,
  codegen: PxmlCodegen,
  runner: PxmlRunner,
  writer: FileWriter,
  mockFixResponse?: string,
  bugContext?: string,
  forceFirstRun?: boolean,
  stack = 'nextjs'
): Promise<boolean> {
  const maxRetries = 3;
  let attempt = 0;

  console.log(`${colors.yellow(colors.bold('[FIX]'))} Starting self-healing loop for node: ${node.id} (Max ${maxRetries} attempts)`);

  while (attempt < maxRetries) {
    attempt++;
    console.log(`${colors.yellow('[FIX]')} Attempt ${attempt}/${maxRetries}...`);

    // 1. Gather failure context
    const currentCode = fs.existsSync(node.meta.path) ? fs.readFileSync(node.meta.path, 'utf-8') : '';
    const testResult = runner.runNodeTests(node, stack);
    
    // Bypass check only on attempt 1 if forceFirstRun is requested
    const bypassCheck = forceFirstRun && attempt === 1;

    if (testResult.passed && !bypassCheck) {
      console.log(`${colors.green(colors.bold('[FIX]'))} Success! Node ${node.id} tests passed on attempt ${attempt}.`);
      
      // Update manifest
      const existing = manifest.getNode(node.id);
      if (existing) {
        manifest.setNode(node.id, {
          ...existing,
          last_test_run: testResult.results
        });
        manifest.save();
      }
      return true;
    }

    // Identify failed cases
    const failedCases = Object.entries(testResult.results)
      .filter(([_, status]) => status === 'fail')
      .map(([name]) => name);

    console.log(`${colors.red(colors.bold('[FIX]'))} Failed test cases: ${failedCases.join(', ')}`);

    const testFilePath = getTestFilePath(node.meta.path, stack);
    const absTestFilePath = path.resolve(projectDir, testFilePath);
    const currentTestCode = fs.existsSync(absTestFilePath) ? fs.readFileSync(absTestFilePath, 'utf-8') : '';

    // 2. Formulate minimal fix-prompt
    const importRules = getImportRules(stack);
    const patchPrompt = fixLoopPrompt({
      nodeId: node.id,
      testOutput: testResult.output || '',
      bugContext: bugContext || '',
      implPath: node.meta.path,
      testFilePath,
      failedCases,
      input: node.input,
      output: node.output,
      constraints: node.constraints,
      currentCode,
      currentTestCode,
      importRules,
    });

    // 3. Request diff/patch from AI (or use mock if provided)
    let patch = '';
    if (mockFixResponse) {
      patch = mockFixResponse;
    } else {
      try {
        patch = await codegen.generateDirect(patchPrompt, FIX_LOOP_SYSTEM);
      } catch (err: any) {
        console.error(`[FIX] AI call failed: ${err.message}. Escalating to user.`);
        return false;
      }
    }

    // 4. Apply patch
    try {
      const filePatches = patch.split(/FILE:\s+/);
      if (filePatches.length > 1) {
        for (const fp of filePatches) {
          if (!fp.trim()) continue;
          const firstLineBreak = fp.indexOf('\n');
          if (firstLineBreak === -1) continue;
          const relativePath = fp.slice(0, firstLineBreak).trim();
          const filePatchContent = fp.slice(firstLineBreak + 1);

          let targetFilePath = path.resolve(projectDir, relativePath);
          if (!fs.existsSync(targetFilePath) && relativePath.startsWith('tests/')) {
            const strippedPath = relativePath.replace(/^tests\//, '');
            const fallbackPath = path.resolve(projectDir, strippedPath);
            if (fs.existsSync(fallbackPath)) {
              targetFilePath = fallbackPath;
            }
          }

          if (fs.existsSync(targetFilePath)) {
            const fileContent = fs.readFileSync(targetFilePath, 'utf-8');
            const patched = PxmlPatcher.applyPatch(fileContent, filePatchContent);
            writer.write(targetFilePath, patched);
            console.log(`${colors.green(colors.bold('[FIX]'))} Applied patch successfully to ${path.relative(projectDir, targetFilePath)}.`);
          }
        }
      } else {
        const patchedCode = PxmlPatcher.applyPatch(currentCode, patch);
        writer.write(node.meta.path, patchedCode);
        console.log(`${colors.green(colors.bold('[FIX]'))} Applied patch successfully to ${node.meta.path}.`);
      }
      console.log(`${colors.cyan(colors.bold('[FIX]'))} Patch details:\n${summarizePatch(patch)}\n`);
    } catch (err: any) {
      console.warn(`${colors.red(colors.bold('[FIX]'))} Failed to apply patch: ${err.message}`);
      // If patch application failed, we retry or escalate
      continue;
    }
  }

  console.error(`${colors.red(colors.bold('[FIX]'))} Failed to self-heal node ${node.id} after ${maxRetries} attempts. Escalating to user.`);
  return false;
}

function summarizePatch(patch: string): string {
  const filePatches = patch.split(/FILE:\s+/);
  if (filePatches.length <= 1) {
    const blocks = PxmlPatcher.parsePatch(patch);
    if (blocks.length > 0) {
      return `  → Modified file: replaced ${blocks[0].search.split('\n').length} line(s) with ${blocks[0].replace.split('\n').length} line(s).`;
    }
    return patch.trim();
  }

  let summary = '';
  for (const fp of filePatches) {
    if (!fp.trim()) continue;
    const firstLineBreak = fp.indexOf('\n');
    if (firstLineBreak === -1) continue;
    const relativePath = fp.slice(0, firstLineBreak).trim();
    const filePatchContent = fp.slice(firstLineBreak + 1);

    const blocks = PxmlPatcher.parsePatch(filePatchContent);
    if (blocks.length > 0) {
      summary += `  → ${relativePath}: replaced ${blocks[0].search.split('\n').length} line(s) with ${blocks[0].replace.split('\n').length} line(s).\n`;
    } else {
      summary += `  → ${relativePath}: replaced content entirely.\n`;
    }
  }
  return summary.trim();
}
