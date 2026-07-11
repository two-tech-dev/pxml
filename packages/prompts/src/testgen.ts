export const TEST_SYSTEM = `You are an expert QA and software testing engineer.
Generate ONLY the complete test file contents. Do not include markdown code block syntax or explanations. Only output test code.
CRITICAL: Stack framework: JS/TS → Vitest, Python → pytest, Go → testing package, C# → xUnit/NUnit.
CRITICAL: Never start a live HTTP server or make real network calls — mock all I/O.
CRITICAL: Next.js 15+ page components with \`searchParams\` as Promise: wrap in \`<Suspense>\`.
CRITICAL: JS/TS tests: add \`// @vitest-environment jsdom\` at top, use RELATIVE imports (e.g. './page'), never \`@/\` aliases.
CRITICAL: Mock constructors/classes with a real class (not arrow function) to avoid "not a constructor" errors.
CRITICAL: Import \`cleanup\` from "@testing-library/react" and call \`afterEach(cleanup)\` explicitly.
CRITICAL: Write at minimum 3 test cases: one happy path, one edge case, one error/validation case.
CRITICAL: For API routes: test both the handler logic AND the response shape. Mock fetch/DB calls.
CRITICAL: For DB models: test CRUD operations. Mock the DB layer, not the real DB.
CRITICAL: For UI components: test rendering, user interaction, and state changes. Use \`@testing-library/react\`.
CRITICAL: Always include meaningful assertion messages: \`expect(result).toBe(expected)\` not just \`expect(result).toBe(true)\`.`;

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
  return `Generate a comprehensive test file for the following implementation node. Write thorough, meaningful tests.

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
- Constraints: ${opts.constraints.map(c => `[${c.verify}] ${c.description}`).join('\n') || 'No explicit constraints'}
- Defined Test Scenarios: ${JSON.stringify(opts.tests) || 'No explicit test scenarios — generate sensible defaults'}

REQUIREMENTS:
1. Write at least 3 test cases minimum: happy path, edge case, error/invalid input
2. For API routes: mock all fetch/DB/file calls. Test both success and error responses.
3. Each test MUST have concrete, meaningful assertions that check actual values, not just truthiness.
4. Test boundary conditions: empty inputs, missing required fields, wrong types.
5. If the code throws errors, test those error paths explicitly with expect().toThrow() or catching.
6. All mocks must use vi.fn() / vi.mock() / vi.spyOn() — never mock with plain object literals.

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
  return `Update the existing test file to match the new implementation. Preserve working tests, add coverage for new behavior.

Implementation File Path: ${opts.implPath}
New Implementation Code:
\`\`\`
${opts.implementationCode}
\`\`\`

Test File Path: ${opts.testPath}
Existing Test Code (UPDATE this, don't discard working tests):
\`\`\`
${opts.existingTestCode}
\`\`\`

XML Specifications:
- Input Fields: ${JSON.stringify(opts.input)}
- Output Fields: ${JSON.stringify(opts.output)}
- Import Directive: ${opts.importStatement} (Use exactly this relative import. Never use path aliases.)
- Constraints: ${opts.constraints.map(c => `[${c.verify}] ${c.description}`).join('\n') || 'No explicit constraints'}

REQUIREMENTS:
1. Keep all existing tests that still pass — only update/modify what changed.
2. Add new tests for new or changed behavior in the implementation.
3. Write at least 3 test cases: happy path, edge case, error/validation.
4. Each test MUST have concrete, meaningful assertions — check actual values, not just truthiness.
5. All mocks must use vi.fn() / vi.mock() / vi.spyOn().
6. Test boundary conditions: empty inputs, missing required fields, wrong types.
7. If the code throws errors, test those error paths explicitly.

Generate the updated complete test code. Do not include markdown wrapping or explanation.`;
}

export const COMBINED_TEST_SYSTEM = `You are an expert QA engineer generating Vitest tests. Output ONLY code.
CRITICAL: Write at least 2 tests per node. One happy path, one edge/error case.
CRITICAL: All assertions must be concrete — check actual values, not just truthiness.
CRITICAL: Mock all external dependencies (fetch, DB, filesystem, HTTP).`;

export function combinedTestPrompt(opts: {
  sections: string;
}): string {
  return `Generate a SINGLE combined Vitest test file testing ALL implementation nodes below.
Import each implementation using local relative paths (e.g. \`import Component from './page'\` or \`import * as handler from './route'\`).
Never use path aliases (like '@/...').

For Next.js page components with Promise searchParams, wrap in '<Suspense>'.
Add '// @vitest-environment jsdom' at the top.
Import 'cleanup' from "@testing-library/react" and call afterEach(cleanup).
Never make real network calls — always mock requests, responses, DB.
All mocks must use vi.fn() / vi.mock() / vi.spyOn().
Write at least 2 tests per node: one happy path, one edge/error case.
All assertions must be concrete — check actual values.

Only output the complete test code, no markdown fences, no explanation.

${opts.sections}`;
}
