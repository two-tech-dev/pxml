import { describe, it, expect } from 'vitest';
import { PxmlCodegen } from './codegen/index.js';
import { FileWriter } from './writer/index.js';
import { Node } from './parser/schema.js';
import * as path from 'path';

const TMP_DIR = '/tmp/pxml-test-providers';

describe('Multi-provider configuration', () => {
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

  it('should allow custom providers to handle generation', async () => {
    const writer = new FileWriter();
    
    const customProvider = {
      generate: async (prompt: string, systemPrompt: string, model: string) => {
        return `// custom generated code using model ${model}`;
      }
    };

    const codegen = new PxmlCodegen({
      provider: 'custom',
      customProvider,
      model: 'my-custom-model'
    });

    const code = await codegen.generateNodeCode(mockNode, 'Context Info', writer);
    expect(code).toBe('// custom generated code using model my-custom-model');
  });

  it('should support ollama provider configuration', () => {
    const codegen = new PxmlCodegen({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: 'http://localhost:11434'
    });
    expect((codegen as any).provider).toBeDefined();
    expect((codegen as any).provider.baseUrl).toBe('http://localhost:11434');
  });
});
