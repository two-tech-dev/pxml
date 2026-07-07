import { Node } from '../parser/schema.js';
import { PxmlCodegen } from '../codegen/index.js';
import { PxmlRunner, getTestFilePath } from '../runner/index.js';
import { PxmlPatcher } from '../patcher/index.js';
import { FileWriter } from '../writer/index.js';
import { PxmlManifest } from '../manifest/index.js';
import * as fs from 'fs';
import * as path from 'path';

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

  console.log(`[FIX] Starting self-healing loop for node: ${node.id} (Max ${maxRetries} attempts)`);

  while (attempt < maxRetries) {
    attempt++;
    console.log(`[FIX] Attempt ${attempt}/${maxRetries}...`);

    // 1. Gather failure context
    const currentCode = fs.existsSync(node.meta.path) ? fs.readFileSync(node.meta.path, 'utf-8') : '';
    const testResult = runner.runNodeTests(node, stack);
    
    // Bypass check only on attempt 1 if forceFirstRun is requested
    const bypassCheck = forceFirstRun && attempt === 1;

    if (testResult.passed && !bypassCheck) {
      console.log(`[FIX] Success! Node ${node.id} tests passed on attempt ${attempt}.`);
      
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

    console.log(`[FIX] Failed test cases: ${failedCases.join(', ')}`);

    const testFilePath = getTestFilePath(node.meta.path, stack);
    const absTestFilePath = path.resolve(projectDir, testFilePath);
    const currentTestCode = fs.existsSync(absTestFilePath) ? fs.readFileSync(absTestFilePath, 'utf-8') : '';

    // 2. Formulate minimal fix-prompt
    const patchPrompt = `You are a software repair AI. The following code or tests for node '${node.id}' have issues.
${bugContext ? `Raw Bug Context / Error Logs:\n${bugContext}\n` : ''}
Path: ${node.meta.path}
Test Path: ${testFilePath}
Failed Cases: ${failedCases.join(', ')}
Node XML spec:
- Input: ${JSON.stringify(node.input)}
- Output: ${JSON.stringify(node.output)}
- Constraints: ${JSON.stringify(node.constraints)}

Current Code:
\`\`\`typescript
${currentCode}
\`\`\`

Current Test Code:
\`\`\`typescript
${currentTestCode}
\`\`\`

Analyze if the issue is in the implementation code or the test code (or both).
Generate SEARCH/REPLACE blocks to patch the files. You MUST prefix each file's search/replace blocks with the header "FILE: [file_path]" where [file_path] is the relative path (either ${node.meta.path} or ${testFilePath}).

Format:
FILE: ${node.meta.path}
<<<<<<< SEARCH
[code to replace]
=======
[replacement code]
>>>>>>> REPLACE

FILE: ${testFilePath}
<<<<<<< SEARCH
[code to replace]
=======
[replacement code]
>>>>>>> REPLACE`;

    // 3. Request diff/patch from AI (or use mock if provided)
    let patch = '';
    if (mockFixResponse) {
      patch = mockFixResponse;
    } else {
      try {
        patch = await codegen.generateDirect(patchPrompt, "Generate only SEARCH/REPLACE patch block.");
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

          const targetFilePath = path.resolve(projectDir, relativePath);
          if (fs.existsSync(targetFilePath)) {
            const fileContent = fs.readFileSync(targetFilePath, 'utf-8');
            const patched = PxmlPatcher.applyPatch(fileContent, filePatchContent);
            writer.write(targetFilePath, patched);
            console.log(`[FIX] Applied patch successfully to ${relativePath}.`);
          }
        }
      } else {
        const patchedCode = PxmlPatcher.applyPatch(currentCode, patch);
        writer.write(node.meta.path, patchedCode);
        console.log(`[FIX] Applied patch successfully to ${node.meta.path}.`);
      }
      console.log(`[FIX] Patch details:\n${patch}\n`);
    } catch (err: any) {
      console.warn(`[FIX] Failed to apply patch: ${err.message}`);
      // If patch application failed, we retry or escalate
      continue;
    }
  }

  console.error(`[FIX] Failed to self-heal node ${node.id} after ${maxRetries} attempts. Escolating to user.`);
  return false;
}
