import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PxmlTestgen } from './testgen/index.js';
import { PxmlRunner, getTestFilePath } from './runner/index.js';
import { FileWriter } from './writer/index.js';
import { Node } from './parser/schema.js';
import * as fs from 'fs';
import * as path from 'path';

const TMP_DIR = '/tmp/pxml-test-runner';

describe('PxmlTestgen & PxmlRunner', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  const mockNode: Node = {
    id: 'api.posts.list',
    type: 'api-route',
    flow: 'blog.read',
    meta: {
      path: path.join(TMP_DIR, 'app/api/posts/route.ts'),
      depends_on: []
    },
    input: [],
    output: [],
    constraints: [],
    tests: [
      {
        name: 'Get posts list default page size',
        given: { query: { limit: 10 } },
        expect: {
          status: 200,
          contains: 'posts'
        }
      }
    ]
  };

  it('should compile XML tests to Vitest format', () => {
    const code = PxmlTestgen.generateTestFileContent(mockNode, path.join(TMP_DIR, '.pxml/tests/api.posts.list.test.ts'));
    expect(code).toContain("describe(\"api.posts.list\"");
    expect(code).toContain("it(\"Get posts list default page size\"");
    expect(code).toContain("expect(res.status).toBe(200);");
  });

  it('should run generated test successfully when file code exists', () => {
    const writer = new FileWriter();
    const runner = new PxmlRunner(TMP_DIR, writer);

    // Write a mock implementation file that exports a default handler returning posts
    const implCode = `
export default async function handler(req) {
  return {
    status: 200,
    json: async () => ({ posts: [] })
  };
}
`;
    writer.write(mockNode.meta.path, implCode);

    const result = runner.runNodeTests(mockNode);
    expect(result.passed).toBe(true);
    expect(result.results['Get posts list default page size']).toBe('pass');
  });

  it('should report failure when test expectation fails', () => {
    const writer = new FileWriter();
    const runner = new PxmlRunner(TMP_DIR, writer);

    // Mock implementation file returning 500
    const implCode = `
export default async function handler(req) {
  return {
    status: 500,
    json: async () => ({ error: 'internal server error' })
  };
}
`;
    writer.write(mockNode.meta.path, implCode);

    const result = runner.runNodeTests(mockNode);
    expect(result.passed).toBe(false);
    expect(result.results['Get posts list default page size']).toBe('fail');
  });
});

describe('getTestFilePath', () => {
  it('should map test file paths based on stack', () => {
    expect(getTestFilePath('app/api/cart.ts', 'nextjs')).toBe('app/api/cart.test.ts');
    expect(getTestFilePath('app/api/cart.tsx', 'nextjs')).toBe('app/api/cart.test.tsx');
    expect(getTestFilePath('pkg/auth/login.go', 'go')).toBe('pkg/auth/login_test.go');
    expect(getTestFilePath('app/api/cart.py', 'python')).toBe('app/api/test_cart.py');
    expect(getTestFilePath('src/Services/AuthService.cs', 'csharp')).toBe('src/Services/AuthService.Tests.cs');
  });
});
