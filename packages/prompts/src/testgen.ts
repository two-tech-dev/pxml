export const TEST_SYSTEM = `You are an expert QA and software testing engineer.
Generate ONLY the complete test file contents. Do not include markdown code block syntax or explanations. Only output test code.
CRITICAL: Stack framework: JS/TS → Vitest, Python → pytest, Go → testing package, C# → xUnit/NUnit.
CRITICAL: Never start a live HTTP server or make real network calls — mock all I/O.
CRITICAL: Next.js 15+ page components with \`searchParams\` as Promise: wrap in \`<Suspense>\`.
CRITICAL: JS/TS tests: add \`// @vitest-environment jsdom\` at top, use RELATIVE imports (e.g. './page'), never \`@/\` aliases.
CRITICAL: Mock constructors/classes with a real class (not arrow function) to avoid "not a constructor" errors.
CRITICAL: Import \`cleanup\` from "@testing-library/react" and call \`afterEach(cleanup)\` explicitly.`;

export function newTestPrompt(opts: {
  implementationCode: string;
  implPath: string;
  testPath: string;
  input: any;
  output: any;
  importStatement: string;
  constraints: { verify: string; description: string }[];
  tests: any;
}): string {
  return `Generate a comprehensive test file for the following implementation node based on its specification and code.
Implementation File Path: ${opts.implPath}
Implementation Code:
\`\`\`
${opts.implementationCode}
\`\`\`

Target Test File Path: ${opts.testPath}
XML Specifications:
- Input Fields: ${JSON.stringify(opts.input)}
- Output Fields: ${JSON.stringify(opts.output)}
- Import Directive: ${opts.importStatement} (Use exactly this relative import. Never use path aliases.)
- Constraints: ${opts.constraints.map(c => `[${c.verify}] ${c.description}`).join('\n')}
- Defined Test Scenarios: ${JSON.stringify(opts.tests)}

Generate the complete test code. Do not include markdown wrapping or explanation.`;
}

export function updateTestPrompt(opts: {
  implementationCode: string;
  implPath: string;
  testPath: string;
  existingTestCode: string;
  input: any;
  output: any;
  importStatement: string;
  constraints: { verify: string; description: string }[];
}): string {
  return `Improve and update the existing test file for this node to match the updated implementation and specifications.
Implementation File Path: ${opts.implPath}
Implementation Code:
\`\`\`
${opts.implementationCode}
\`\`\`

Test File Path: ${opts.testPath}
Existing Test Code:
\`\`\`
${opts.existingTestCode}
\`\`\`

XML Specifications:
- Input Fields: ${JSON.stringify(opts.input)}
- Output Fields: ${JSON.stringify(opts.output)}
- Import Directive: ${opts.importStatement} (Use exactly this relative import. Never use path aliases.)
- Constraints: ${opts.constraints.map(c => `[${c.verify}] ${c.description}`).join('\n')}

Generate the updated complete test code. Do not include markdown wrapping or explanation.`;
}

export const COMBINED_TEST_SYSTEM = `You are an expert QA engineer generating Vitest tests. Output ONLY code.`;

export function combinedTestPrompt(opts: {
  sections: string;
}): string {
  return `You are generating a SINGLE combined Vitest test file that tests ALL of the following implementation nodes.
Import each implementation using a local relative path (e.g. \`import Component from './page'\` or \`import * as handler from './route'\`).
Never use path aliases (like '@/...').

For Next.js page components with Promise searchParams, wrap in '<Suspense>'.
Add '// @vitest-environment jsdom' at the top.
Import 'cleanup' from "@testing-library/react" and call afterEach(cleanup).
Never make real network calls — always mock requests, responses, DB.

Only output the complete test code, no markdown fences, no explanation.
Write ONE combined file that covers all nodes below.

${opts.sections}`;
}
