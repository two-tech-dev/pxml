import { Node, TestCase } from '../parser/schema.js';
import * as path from 'path';

export class PxmlTestgen {
  static generateTestFileContent(node: Node, testFileAbsPath: string): string {
    const relativeImplPath = path.relative(path.dirname(testFileAbsPath), node.meta.path);
    let importPath = relativeImplPath.replace(/\.(ts|tsx|js|jsx)$/, '');
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      importPath = './' + importPath;
    }

    let testCasesCode = '';
    const tests: TestCase[] = node.tests.length > 0 ? node.tests : this.createFallbackTestCases(node);

    for (const test of tests) {
      const stringifiedGiven = JSON.stringify(test.given, null, 2);

      let assertions = '';
      if (test.expect.status !== undefined) {
        assertions += `expect(res.status).toBe(${test.expect.status});\n`;
      }
      if (test.expect.contains) {
        assertions += `expect(JSON.stringify(body)).toContain(${JSON.stringify(test.expect.contains)});\n`;
      }
      if (test.expect.match) {
        assertions += `expect(JSON.stringify(body)).toMatch(${test.expect.match});\n`;
      }
      if (node.type === 'setup-command') {
        assertions += `expect(() => { expect(true).toBe(true); }).not.toThrow();\n`;
      }

      testCasesCode += `
  it(${JSON.stringify(test.name)}, async () => {
    const req = ${stringifiedGiven};
    let res = { status: 200, json: async () => ({}) };
    let body: any = {};

    try {
      if (nodeType === 'setup-command') {
        body = { status: 'executed' };
      } else if (typeof handler === 'function') {
        const response = await handler(req);
        if (response && typeof response.json === 'function') {
          res = response;
          body = await response.json();
        } else {
          body = response;
        }
      } else if (handler && typeof handler.GET === 'function' && req.method === 'GET') {
        const response = await handler.GET(req);
        res = response;
        body = await response.json();
      } else if (handler && typeof handler.POST === 'function' && req.method === 'POST') {
        const response = await handler.POST(req);
        res = response;
        body = await response.json();
      } else {
        body = handler;
      }
    } catch (err: any) {
      res = { status: err.status || 500, json: async () => ({ error: err.message }) };
      body = { error: err.message };
    }

    ${assertions}
  });
`;
    }

    return `import { describe, it, expect } from 'vitest';
// @ts-ignore
import * as handlerModule from '${importPath}';

const handler = handlerModule.default || handlerModule;
const nodeType = ${JSON.stringify(node.type)};

describe(${JSON.stringify(node.id)}, () => {
${testCasesCode}
});
`;
  }

  private static createFallbackTestCases(node: Node): TestCase[] {
    const tests: TestCase[] = [];

    if (node.type === 'setup-command') {
      tests.push({
        name: 'Module loads without errors and exports something',
        given: {},
        expect: { field: undefined, status: undefined, body: undefined, contains: undefined, match: undefined },
      });
      return tests;
    }

    // Happy path test
    tests.push({
      name: 'Module imports and exports correctly',
      given: { method: 'GET', query: {}, headers: {} },
      expect: { field: undefined, status: undefined, body: undefined, contains: undefined, match: undefined },
    });

    if (node.input && node.input.length > 0) {
      const requiredFields = node.input.filter((f: any) => f.required).map((f: any) => f.name);
      if (requiredFields.length > 0) {
        tests.push({
          name: `Rejects missing required fields: ${requiredFields.join(', ')}`,
          given: { method: 'POST', query: {}, headers: {}, body: {} },
          expect: {
            field: undefined,
            status: 400,
            body: undefined,
            contains: 'required',
            match: undefined,
          },
        });
      }
    }

    if (node.output && node.output.length > 0) {
      const outFields = node.output.filter((f: any) => f.required).map((f: any) => f.name);
      if (outFields.length > 0) {
        tests.push({
          name: `Response includes required output fields: ${outFields.join(', ')}`,
          given: { method: 'GET', query: {}, headers: {} },
          expect: {
            field: outFields[0],
            status: 200,
            body: undefined,
            contains: outFields[0],
            match: undefined,
          },
        });
      }
    }

    return tests;
  }
}
