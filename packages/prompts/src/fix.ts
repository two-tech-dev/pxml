export const VALIDATE_FIX_SYSTEM = `Generate only SEARCH/REPLACE patch block, or the word NODEP if a dependency is missing.`;

export function validateFixPrompt(opts: {
  path: string;
  errors: string;
  currentCode: string;
  importRules: string;
}): string {
  return `You are a software repair AI. The following generated file has syntax/type errors reported by the compiler/linter.
Path: ${opts.path}
Reported Errors:
${opts.errors}

Current Code:
\`\`\`
${opts.currentCode}
\`\`\`

${opts.importRules}

Generate SEARCH/REPLACE blocks to fix ONLY the reported errors in ${opts.path}.
- Use the header "FILE: ${opts.path}" followed by a <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE block.
- If an error is caused by a MISSING DEPENDENCY, output NODEP.
- Otherwise output only the patch.`;
}

export const FIX_LOOP_SYSTEM = `Generate only SEARCH/REPLACE patch block.`;

export function fixLoopPrompt(opts: {
  nodeId: string;
  testOutput: string;
  bugContext: string;
  implPath: string;
  testFilePath: string;
  failedCases: string[];
  input: any;
  output: any;
  constraints: any;
  currentCode: string;
  currentTestCode: string;
  importRules: string;
}): string {
  return `You are a software repair AI. The following code or tests for node '${opts.nodeId}' have issues.
${opts.testOutput ? `Test Execution Failure Errors:\n${opts.testOutput}\n` : ''}
${opts.bugContext ? `Raw Bug Context / Error Logs:\n${opts.bugContext}\n` : ''}
Path: ${opts.implPath}
Test Path: ${opts.testFilePath}
Failed Cases: ${opts.failedCases.join(', ')}
Node XML spec:
- Input: ${JSON.stringify(opts.input)}
- Output: ${JSON.stringify(opts.output)}
- Constraints: ${JSON.stringify(opts.constraints)}

Current Code:
\`\`\`
${opts.currentCode}
\`\`\`

Current Test Code:
\`\`\`
${opts.currentTestCode}
\`\`\`

Analyze if the issue is in the implementation code or the test code (or both).
CRITICAL: Do not break the code's core business logic. If the test fails due to incorrect assertions, mock setups, or environment mismatches, patch the test file instead.
${opts.importRules}
Generate SEARCH/REPLACE blocks to patch the files. Prefix each file with "FILE: [file_path]".

Format:
FILE: ${opts.implPath}
<<<<<<< SEARCH
[code to replace]
=======
[replacement code]
>>>>>>> REPLACE

FILE: ${opts.testFilePath}
<<<<<<< SEARCH
[code to replace]
=======
[replacement code]
>>>>>>> REPLACE`;
}

export const BUILD_FIX_SYSTEM = `Generate SEARCH/REPLACE patches for the build errors, or the word NODEP if a dependency is missing.`;

export function buildFixPrompt(errors: string): string {
  return `The project failed to build. Below are the build errors. Fix ALL errors by editing the affected files.
${errors.slice(0, 6000)}

Use SEARCH/REPLACE patch blocks. Prefix each file with "FILE: <relative_path>".
- If an error is caused by a MISSING DEPENDENCY, reply with NODEP.
- Otherwise output only the patches.`;
}
