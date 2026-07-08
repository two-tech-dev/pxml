import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PxmlCache } from '../src/cache/index.ts';
import { PxmlManifest } from '../src/manifest/index.ts';
import { Node } from '../src/parser/schema.js';
import * as fs from 'fs';
import * as path from 'path';

const TMP_DIR = '/tmp/pxml-test-manifest';

describe('PxmlCache & Manifest', () => {
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
      path: 'app/api/posts/route.ts',
      depends_on: []
    },
    input: [],
    output: [],
    constraints: [],
    tests: []
  };

  it('should generate stable hash for same node structure', () => {
    const hash1 = PxmlCache.hashNode(mockNode);
    const hash2 = PxmlCache.hashNode({ ...mockNode });
    expect(hash1).toBe(hash2);

    const changedNode = { ...mockNode, flow: 'blog.admin' };
    const hash3 = PxmlCache.hashNode(changedNode);
    expect(hash1).not.toBe(hash3);
  });

  it('should load, update, save, and lock manifest states', () => {
    const manifest = new PxmlManifest(TMP_DIR, 'test-project', '0.1.0');
    const hash = PxmlCache.hashNode(mockNode);

    manifest.setNode(mockNode.id, {
      node_id: mockNode.id,
      source_file: 'blog.xml',
      xml_hash: hash,
      output_files: [mockNode.meta.path],
      depends_on: mockNode.meta.depends_on,
      flow: mockNode.flow,
      generated_at: new Date().toISOString()
    });
    manifest.save();

    // Re-load
    const manifest2 = new PxmlManifest(TMP_DIR, 'test-project', '0.1.0');
    const node = manifest2.getNode(mockNode.id);
    expect(node).toBeDefined();
    expect(node?.xml_hash).toBe(hash);
    expect(node?.locked).toBe(false);

    // Lock node
    manifest2.lockNode(mockNode.id, true);
    const lockedNode = new PxmlManifest(TMP_DIR, 'test-project', '0.1.0').getNode(mockNode.id);
    expect(lockedNode?.locked).toBe(true);
  });
});
