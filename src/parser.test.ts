import { describe, it, expect } from 'vitest';
import { PxmlParser, validateProject } from '../src/parser/index.ts';
import { DependencyGraph } from '../src/graph/index.ts';
import * as path from 'path';

describe('PxmlParser', () => {
  it('should parse project, resolve imports, merge extends, and detect cycles', () => {
    const parser = new PxmlParser();
    const projectXml = path.resolve(__dirname, '../fixtures/project.xml');
    const project = parser.parse(projectXml);

    expect(project.name).toBe('main-blog');
    expect(project.nodes.length).toBe(3); // base.api-route, db.post, and api.posts.list (with namespace prefixes)

    const listNode = project.nodes.find(n => n.id === 'read:api.posts.list');
    expect(listNode).toBeDefined();
    expect(listNode?.type).toBe('api-route');
    // Inherited metadata and constraints
    expect(listNode?.meta.path).toBe('app/api/posts/route.ts');
    expect(listNode?.constraints.length).toBe(3); // 1 from parent, 2 from listNode
    expect(listNode?.constraints[0].description).toBe('No sensitive data leakage in response or logs');
    expect(listNode?.constraints[1].description).toBe('Sort by publishedAt descending');
  });

  it('should throw circular import error', () => {
    const parser = new PxmlParser();
    const fs = require('fs');
    fs.writeFileSync('/tmp/a.xml', `<project name="a" stack="nextjs" version="0.1.0"><import src="b.xml" as="b"/></project>`);
    fs.writeFileSync('/tmp/b.xml', `<project name="b" stack="nextjs" version="0.1.0"><import src="a.xml" as="a"/></project>`);

    expect(() => parser.parse('/tmp/a.xml')).toThrow('Circular import detected');
  });

  it('should parse learned-from attribute on constraints', () => {
    const parser = new PxmlParser();
    const fs = require('fs');
    fs.writeFileSync('/tmp/learned_test.xml', `
      <project name="learned-test" stack="nextjs" version="0.1.0">
        <node id="node.test" type="api-route" flow="test">
          <meta>
            <path>app/api/test.ts</path>
          </meta>
          <constraint verify="static" learned-from="bug.db_lock">Do not block db connections</constraint>
        </node>
      </project>
    `);
    const project = parser.parse('/tmp/learned_test.xml');
    const node = project.nodes.find(n => n.id === 'node.test');
    expect(node).toBeDefined();
    expect(node?.constraints[0].learnedFrom).toBe('bug.db_lock');
    expect(node?.constraints[0].verify).toBe('static');
    expect(node?.constraints[0].description).toBe('Do not block db connections');
  });
});

describe('DependencyGraph', () => {
  it('should sort nodes topologically and detect circular dependency', () => {
    const parser = new PxmlParser();
    const projectXml = path.resolve(__dirname, '../fixtures/project.xml');
    const project = parser.parse(projectXml);

    const graph = new DependencyGraph(project.nodes);
    const order = graph.getSortOrder();

    // db.post should come before api.posts.list because api.posts.list depends on db.post
    const dbIndex = order.indexOf('read:types:db.post');
    const apiIndex = order.indexOf('read:api.posts.list');
    expect(dbIndex).toBeGreaterThan(-1);
    expect(apiIndex).toBeGreaterThan(-1);
    expect(dbIndex).toBeLessThan(apiIndex);
  });
});

describe('validateProject', () => {
  it('should throw if a node has output but no tests', () => {
    const project = {
      name: 'test',
      stack: 'nextjs',
      version: '0.1.0',
      nodes: [
        {
          id: 'api.test',
          type: 'api-route',
          flow: 'test',
          meta: { path: 'app/api/test.ts', depends_on: [] },
          input: [],
          output: [{ name: 'res', type: 'string', required: true }],
          constraints: [],
          tests: []
        }
      ]
    };
    expect(() => validateProject(project)).toThrow("has output fields defined, but is missing test cases");
  });

  it('should throw if a node test is missing required input fields', () => {
    const project = {
      name: 'test',
      stack: 'nextjs',
      version: '0.1.0',
      nodes: [
        {
          id: 'api.test',
          type: 'api-route',
          flow: 'test',
          meta: { path: 'app/api/test.ts', depends_on: [] },
          input: [{ name: 'title', type: 'string', required: true }],
          output: [],
          constraints: [],
          tests: [
            {
              name: 'Invalid Test',
              given: { body: {} },
              expect: {}
            }
          ]
        }
      ]
    };
    expect(() => validateProject(project)).toThrow("missing required input field 'title'");
  });

  it('should throw if a node test contains field not declared in input', () => {
    const project = {
      name: 'test',
      stack: 'nextjs',
      version: '0.1.0',
      nodes: [
        {
          id: 'api.test',
          type: 'api-route',
          flow: 'test',
          meta: { path: 'app/api/test.ts', depends_on: [] },
          input: [{ name: 'title', type: 'string', required: true }],
          output: [],
          constraints: [],
          tests: [
            {
              name: 'Extra Field Test',
              given: { body: { title: 'hello', unknownField: 'extra' } },
              expect: {}
            }
          ]
        }
      ]
    };
    expect(() => validateProject(project)).toThrow("specifies field 'unknownField' in given body which is not declared in node inputs");
  });

  it('should not throw if valid', () => {
    const project = {
      name: 'test',
      stack: 'nextjs',
      version: '0.1.0',
      nodes: [
        {
          id: 'api.test',
          type: 'api-route',
          flow: 'test',
          meta: { path: 'app/api/test.ts', depends_on: [] },
          input: [{ name: 'title', type: 'string', required: true }],
          output: [{ name: 'id', type: 'string', required: true }],
          constraints: [],
          tests: [
            {
              name: 'Valid Test',
              given: { body: { title: 'hello' } },
              expect: {}
            }
          ]
        }
      ]
    };
    expect(() => validateProject(project)).not.toThrow();
  });

  it('should parse and resolve local packages', () => {
    const parser = new PxmlParser();
    const fs = require('fs');
    
    fs.mkdirSync('/tmp/packages/test-pack', { recursive: true });
    
    fs.writeFileSync('/tmp/packages/test-pack/project.xml', `
      <project name="test-pack" stack="nextjs" version="0.1.0">
        <node id="base-node" type="setup-command" flow="setup">
          <meta><path>package.json</path></meta>
          <constraint verify="static">Mock setup command</constraint>
        </node>
      </project>
    `);
    
    fs.writeFileSync('/tmp/main_proj.xml', `
      <project name="main-project" stack="nextjs" version="0.1.0">
        <import package="test-pack" from="/tmp/packages/test-pack" as="tpl" />
        <node id="setup.nextjs" type="setup-command" flow="setup" extends="tpl:base-node" />
      </project>
    `);
    
    const project = parser.parse('/tmp/main_proj.xml');
    expect(project.nodes.length).toBe(2);
    
    const setupNode = project.nodes.find(n => n.id === 'setup.nextjs');
    expect(setupNode).toBeDefined();
    expect(setupNode?.extends).toBe('tpl:base-node');
    expect(setupNode?.constraints[0].description).toBe('Mock setup command');
  });
});
