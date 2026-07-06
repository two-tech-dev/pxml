import { Node } from '../parser/schema.js';
import { PxmlCodegen } from '../codegen/index.js';
import { PxmlRunner } from '../runner/index.js';
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
  bugContext?: string
): Promise<boolean> {
  const maxRetries = 3;
  let attempt = 0;

  console.log(`[FIX] Starting self-healing loop for node: ${node.id} (Max ${maxRetries} attempts)`);

  while (attempt < maxRetries) {
    attempt++;
    console.log(`[FIX] Attempt ${attempt}/${maxRetries}...`);

    // 1. Gather failure context
    const currentCode = fs.existsSync(node.meta.path) ? fs.readFileSync(node.meta.path, 'utf-8') : '';
    const testResult = runner.runNodeTests(node);
    
    if (testResult.passed) {
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

    // 2. Formulate minimal fix-prompt
    const patchPrompt = `You are a software repair AI. The following code for node '${node.id}' has issues.
${bugContext ? `Raw Bug Context / Error Logs:\n${bugContext}\n` : ''}
Path: ${node.meta.path}
Failed Cases: ${failedCases.join(', ')}
Node XML spec:
- Input: ${JSON.stringify(node.input)}
- Output: ${JSON.stringify(node.output)}
- Constraints: ${JSON.stringify(node.constraints)}

Current Code:
\`\`\`typescript
${currentCode}
\`\`\`

Generate a SEARCH/REPLACE block to patch the code and fix the failures. Format:
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
      const patchedCode = PxmlPatcher.applyPatch(currentCode, patch);
      writer.write(node.meta.path, patchedCode);
      console.log(`[FIX] Applied patch successfully.`);
    } catch (err: any) {
      console.warn(`[FIX] Failed to apply patch: ${err.message}`);
      // If patch application failed, we retry or escalate
      continue;
    }
  }

  console.error(`[FIX] Failed to self-heal node ${node.id} after ${maxRetries} attempts. Escolating to user.`);
  return false;
}
