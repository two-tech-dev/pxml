import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runFixLoop } from '../src/cli/fix.ts';
import { PxmlManifest } from '../src/manifest/index.ts';
import { PxmlCodegen } from '../src/codegen/index.ts';
import { PxmlRunner } from '../src/runner/index.ts';
import { FileWriter } from '../src/writer/index.ts';
import { Node } from '../src/parser/schema.js';
import * as fs from 'fs';
import * as path from 'path';

const TMP_DIR = '/tmp/pxml-test-fix';

describe('Fix self-healing loop', () => {
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
    tests: [
      {
        name: 'Create post successful',
        given: { query: { title: 'hello' } },
        expect: {
          status: 200,
          contains: 'success'
        }
      }
    ]
  };

  it('should run fix loop successfully with AI patches', async () => {
    const writer = new FileWriter();
    const manifest = new PxmlManifest(TMP_DIR, 'test-project', '0.1.0');
    
    // First, compile node which will fail initially (we write empty or broken code)
    const initialCode = `
export default async function handler(req) {
  return {
    status: 500,
    json: async () => ({})
  };
}
`;
    writer.write(mockNode.meta.path, initialCode);

    manifest.setNode(mockNode.id, {
      node_id: mockNode.id,
      source_file: 'project.xml',
      xml_hash: '123',
      output_files: [mockNode.meta.path],
      depends_on: [],
      flow: mockNode.flow
    });
    manifest.save();

    const codegen = new PxmlCodegen({
      model: 'claude-3-5-sonnet',
      mockResponse: () => ''
    });

    const runner = new PxmlRunner(TMP_DIR, writer);

    // Patch that AI is supposed to return:
    const mockPatch = `
<<<<<<< SEARCH
export default async function handler(req) {
  return {
    status: 500,
    json: async () => ({})
  };
}
=======
export default async function handler(req) {
  return {
    status: 200,
    json: async () => ({ success: true })
  };
}
>>>>>>> REPLACE
`;

    const success = await runFixLoop(
      mockNode,
      TMP_DIR,
      manifest,
      codegen,
      runner,
      writer,
      mockPatch
    );

    expect(success).toBe(true);
    expect(fs.readFileSync(mockNode.meta.path, 'utf-8')).toContain('success: true');
  });

  it('should support multi-file patches targeting both code and tests', async () => {
    const writer = new FileWriter();
    const manifest = new PxmlManifest(TMP_DIR, 'test-project', '0.1.0');
    
    const initialCode = `export default async function handler(req) { return { status: 500 }; }`;
    writer.write(mockNode.meta.path, initialCode);

    const testPath = path.join(TMP_DIR, 'tests/app/api/posts/route.test.ts');
    const initialTestCode = `// Broken test`;
    writer.write(testPath, initialTestCode);

    const codegen = new PxmlCodegen({
      model: 'claude',
      mockResponse: () => ''
    });
    const runner = new PxmlRunner(TMP_DIR, writer);

    const mockPatch = `
FILE: app/api/posts/route.ts
<<<<<<< SEARCH
export default async function handler(req) { return { status: 500 }; }
=======
export default async function handler(req) { return { status: 200, json: async () => ({ success: true }) }; }
>>>>>>> REPLACE

FILE: tests/app/api/posts/route.test.ts
<<<<<<< SEARCH
// Broken test
=======
import { describe, it, expect } from 'vitest';
describe('api.posts.create', () => {
  it('Create post successful', () => { expect(true).toBe(true); });
});
>>>>>>> REPLACE
`;

    const success = await runFixLoop(
      mockNode,
      TMP_DIR,
      manifest,
      codegen,
      runner,
      writer,
      mockPatch
    );

    expect(success).toBe(true);
    expect(fs.readFileSync(mockNode.meta.path, 'utf-8')).toContain('success: true');
    expect(fs.readFileSync(testPath, 'utf-8')).toContain('describe(\'api.posts.create\'');
  });
});
