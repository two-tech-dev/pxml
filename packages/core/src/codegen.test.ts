import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PxmlCodegen } from './codegen/index.js';
import { FileWriter } from './writer/index.js';
import { Node } from './parser/schema.js';
import * as fs from 'fs';
import * as path from 'path';

const TMP_DIR = '/tmp/pxml-test-codegen';

describe('PxmlCodegen & FileWriter', () => {
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
    id: 'api.posts.create',
    type: 'api-route',
    flow: 'blog.write',
    meta: {
      path: path.join(TMP_DIR, 'app/api/posts/route.ts'),
      depends_on: []
    },
    input: [],
    output: [],
    constraints: [],
    tests: []
  };

  it('should write mock generated code and write files', async () => {
    const writer = new FileWriter();
    const codegen = new PxmlCodegen({
      model: 'claude-3-5-sonnet',
      mockResponse: (node) => `// generated code for ${node.id}`
    });

    const code = await codegen.generateNodeCode(mockNode, 'Context Info', writer);
    expect(code).toBe('// generated code for api.posts.create');
    expect(fs.readFileSync(mockNode.meta.path, 'utf-8')).toBe(code);
  });

  it('should support dry-run without writing files', async () => {
    const writer = new FileWriter(true); // dryRun = true
    const codegen = new PxmlCodegen({
      model: 'claude-3-5-sonnet',
      mockResponse: (node) => `// generated code for ${node.id}`
    });

    await codegen.generateNodeCode(mockNode, 'Context Info', writer);
    expect(fs.existsSync(mockNode.meta.path)).toBe(false);
  });

  it('should support rollback to original content', async () => {
    const writer = new FileWriter();
    const testFile = path.join(TMP_DIR, 'test-rollback.txt');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, 'original content', 'utf-8');

    writer.write(testFile, 'new content');
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('new content');

    writer.rollback();
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('original content');
  });

  it('should clean trailing annotation comments successfully', () => {
    const codegen = new PxmlCodegen({
      model: 'claude-3-5-sonnet',
      mockResponse: () => 'const a = 1;\n\n// skipped: database setup, add when schema is defined.'
    });
    const cleaned = (codegen as any).cleanMarkdown('const a = 1;\n\n→ skipped: database setup, add when schema is defined.');
    expect(cleaned).toBe('const a = 1;');
  });
});
