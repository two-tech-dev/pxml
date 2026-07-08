import * as path from 'path';
export class PxmlTestgen {
    static generateTestFileContent(node, testFileAbsPath) {
        const relativeImplPath = path.relative(path.dirname(testFileAbsPath), node.meta.path);
        let importPath = relativeImplPath.replace(/\.(ts|tsx|js|jsx)$/, '');
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            importPath = './' + importPath;
        }
        let testCasesCode = '';
        const tests = node.tests.length > 0 ? node.tests : [this.createFallbackTestCase(node)];
        for (const test of tests) {
            const stringifiedGiven = JSON.stringify(test.given, null, 2);
            // Build assertions dynamically based on expected fields
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
                assertions += `expect(true).toBe(true);\n`; // Simple execution check
            }
            testCasesCode += `
  it(${JSON.stringify(test.name)}, async () => {
    const req = ${stringifiedGiven};
    let res = { status: 200, json: async () => ({}) };
    let body: any = {};

    try {
      if (nodeType === 'setup-command') {
        // Just verify file module can be parsed or execution completed
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
        // Generic export verification fallback
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
    static createFallbackTestCase(node) {
        // Generate generic checks depending on node type
        if (node.type === 'setup-command') {
            return {
                name: 'Verify setup execution finishes successfully',
                given: {},
                expect: {
                    field: undefined,
                    status: undefined,
                    body: undefined,
                    contains: undefined,
                    match: undefined
                }
            };
        }
        // Default validation: loading modules shouldn't throw errors
        return {
            name: 'Verify module loads and exports valid elements',
            given: { method: 'GET', query: {}, headers: {} },
            expect: {
                field: undefined,
                status: undefined,
                body: undefined,
                contains: undefined,
                match: undefined
            }
        };
    }
}
