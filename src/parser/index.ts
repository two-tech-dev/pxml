import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ProjectSchema, Project, Node, NodeSchema } from './schema.js';

interface RawNode {
  '@_id': string;
  '@_type': string;
  '@_flow': string;
  '@_extends'?: string;
  '@_autogen-tests'?: string | boolean;
  meta?: {
    path?: string;
    depends_on?: string | string[];
  };
  input?: { field?: any[] | any };
  output?: { field?: any[] | any };
  constraint?: any[] | any;
  test?: any[] | any;
}

interface RawImport {
  '@_src'?: string;
  '@_package'?: string;
  '@_from'?: string;
  '@_as': string;
}

interface RawProject {
  project: {
    '@_name': string;
    '@_stack': string;
    '@_version': string;
    '@_autogen-tests'?: string | boolean;
    import?: RawImport[] | RawImport;
    node?: RawNode[] | RawNode;
  };
}

export class PxmlParser {
  private visitedFiles = new Set<string>();
  private loadedProjects = new Map<string, Project>();

  parse(filePath: string): Project {
    const absolutePath = path.resolve(filePath);
    if (this.visitedFiles.has(absolutePath)) {
      throw new Error(`Circular import detected: ${Array.from(this.visitedFiles).join(' -> ')} -> ${absolutePath}`);
    }

    this.visitedFiles.add(absolutePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const xmlContent = fs.readFileSync(absolutePath, 'utf-8');
    const options = {
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseAttributeValue: true,
    };
    const parser = new XMLParser(options);
    const parsedObj = parser.parse(xmlContent) as RawProject;

    if (!parsedObj.project) {
      throw new Error(`Invalid pxml file: root element must be <project> in ${absolutePath}`);
    }

    const rawProj = parsedObj.project;
    const name = String(rawProj['@_name'] || '');
    const stack = String(rawProj['@_stack'] || '');
    const version = String(rawProj['@_version'] || '');
    const autogenTestsProj = rawProj['@_autogen-tests'] !== undefined ? String(rawProj['@_autogen-tests']) === 'true' : true;

    const rawImports = rawProj.import 
      ? (Array.isArray(rawProj.import) ? rawProj.import : [rawProj.import]) 
      : [];
    const parsedImports = rawImports.map(imp => ({
      src: imp['@_src'],
      package: imp['@_package'],
      from: imp['@_from'],
      as: imp['@_as']
    }));

    const rawNodes = rawProj.node
      ? (Array.isArray(rawProj.node) ? rawProj.node : [rawProj.node])
      : [];

    const nodes: Node[] = rawNodes.map(rn => {
      const dependsRaw = rn.meta?.depends_on;
      const dependsOn: string[] = [];
      if (typeof dependsRaw === 'string') {
        dependsOn.push(dependsRaw);
      } else if (Array.isArray(dependsRaw)) {
        dependsOn.push(...dependsRaw);
      }

      const inputRaw = rn.input?.field;
      const input = inputRaw
        ? (Array.isArray(inputRaw) ? inputRaw : [inputRaw]).map(f => ({
            name: f['@_name'],
            type: f['@_type'],
            required: f['@_required'] !== undefined ? String(f['@_required']) === 'true' : true,
            format: f['@_format']
          }))
        : [];

      const outputRaw = rn.output?.field;
      const output = outputRaw
        ? (Array.isArray(outputRaw) ? outputRaw : [outputRaw]).map(f => ({
            name: f['@_name'],
            type: f['@_type'],
            required: f['@_required'] !== undefined ? String(f['@_required']) === 'true' : true,
            format: f['@_format']
          }))
        : [];

      const constraintRaw = rn.constraint;
      const constraints = constraintRaw
        ? (Array.isArray(constraintRaw) ? constraintRaw : [constraintRaw]).map(c => {
            const verify = c['@_verify'] || 'static';
            const description = typeof c === 'object' ? c['#text'] || '' : String(c);
            const learnedFrom = typeof c === 'object' ? c['@_learned-from'] : undefined;
            return { verify, description, learnedFrom };
          })
        : [];

      const testRaw = rn.test;
      const tests = testRaw
        ? (Array.isArray(testRaw) ? testRaw : [testRaw]).map(t => {
            const nameVal = t.name || '';
            const given = t.given || {};
            const expectRaw = t.expect || {};
            const expect = {
              field: expectRaw.field,
              status: expectRaw.status !== undefined ? Number(expectRaw.status) : undefined,
              body: expectRaw.body,
              contains: expectRaw.contains,
              match: expectRaw.match
            };
            return { name: nameVal, given, expect };
          })
        : [];

      const autogenTestsNode = rn['@_autogen-tests'] !== undefined ? String(rn['@_autogen-tests']) === 'true' : undefined;
      const autogenTests = autogenTestsNode ?? autogenTestsProj;

      return NodeSchema.parse({
        id: rn['@_id'],
        type: rn['@_type'],
        flow: rn['@_flow'],
        extends: rn['@_extends'],
        autogenTests,
        meta: {
          path: rn.meta?.path || '',
          depends_on: dependsOn
        },
        input,
        output,
        constraints,
        tests
      });
    });

    const currentProject = ProjectSchema.parse({
      name,
      stack,
      version,
      autogenTests: autogenTestsProj,
      imports: parsedImports,
      nodes
    });

    this.loadedProjects.set(absolutePath, currentProject);

    // Resolve imports recursively and build final flattened project AST
    const baseDir = path.dirname(absolutePath);
    const resolvedNodes: Node[] = [];

    // Track imported files to avoid duplicate parsing/nodes if imported multiple times
    const importedPaths = new Set<string>();

    const prefixNode = (node: Node, namespace: string): Node => {
      const prefixId = (id: string) => {
        if (id.includes(':')) {
          // If it already has namespace, prepend new namespace
          return `${namespace}:${id}`;
        }
        return `${namespace}:${id}`;
      };

      return {
        ...node,
        id: prefixId(node.id),
        extends: node.extends ? prefixId(node.extends) : undefined,
        meta: {
          ...node.meta,
          depends_on: node.meta.depends_on.map(prefixId)
        }
      };
    };

    for (const imp of currentProject.imports) {
      let importedPath = '';
      if (imp.src) {
        importedPath = path.resolve(baseDir, imp.src);
      } else if (imp.package && imp.from) {
        if (imp.from.startsWith('github:')) {
          const parts = imp.from.replace(/^github:/, '').split('/');
          const owner = parts[0];
          const repo = parts[1];
          const cacheDir = path.join(process.cwd(), '.pxml', 'packages', 'github', owner, repo);
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
            const gitUrl = `https://github.com/${owner}/${repo}.git`;
            console.log(`[PACKAGE] Cloning package ${imp.package} from ${gitUrl}...`);
            const { execSync } = require('child_process');
            execSync(`git clone --depth 1 ${gitUrl} ${cacheDir}`, { stdio: 'ignore' });
          }
          importedPath = path.join(cacheDir, 'project.xml');
        } else {
          importedPath = path.resolve(process.cwd(), imp.from, 'project.xml');
        }
      }

      if (!importedPath || !fs.existsSync(importedPath)) {
        throw new Error(`Import failed: package/src not found at ${importedPath || imp.src || imp.from}`);
      }

      if (importedPaths.has(importedPath)) continue;
      importedPaths.add(importedPath);

      const importedProj = this.parse(importedPath);

      // We only prefix nodes that were defined in the imported project,
      // which includes nodes it has imported. Let's make sure we prefix all of them.
      const prefixedNodes = importedProj.nodes.map(node => prefixNode(node, imp.as));
      resolvedNodes.push(...prefixedNodes);
    }

    // Only include currentProject nodes if this is NOT an imported project,
    // or include them and let the caller manage prefixing.
    // Actually, to make a unified flat AST, the entry project XML (e.g. project.xml) has nodes of its own,
    // and also brings in imported nodes.
    // If we are parsing a nested import, we return its nodes, which get prefixed by the parent parser.
    // So the parser call should just return the currentProject.nodes.
    // But wait! If currentProject has nodes and imports, does currentProject.nodes already get returned? Yes.
    // But does currentProject.nodes contain the resolved import nodes? No, they are only in resolvedNodes.
    // So we should return resolvedNodes (which includes currentProject.nodes plus the prefixed imported nodes).
    resolvedNodes.push(...currentProject.nodes);

    this.visitedFiles.delete(absolutePath);

    // Print resolved node IDs for debugging if needed
    // console.log(resolvedNodes.map(n => n.id));
    
    // Dedup nodes here to avoid extending issues or duplicate resolve calls
    const resolvedNodesMap = new Map<string, Node>();
    for (const node of resolvedNodes) {
      resolvedNodesMap.set(node.id, node);
    }
    const uniqueResolvedNodes = Array.from(resolvedNodesMap.values());

    const finalNodes = this.resolveExtends(uniqueResolvedNodes);
    
    // Deduplicate nodes by id, taking the last defined (allows overrides)
    const dedupedMap = new Map<string, Node>();
    for (const node of finalNodes) {
      dedupedMap.set(node.id, node);
    }

    return {
      ...currentProject,
      imports: [], // Empty imports as they are now flattened
      nodes: Array.from(dedupedMap.values())
    };
  }

  private resolveExtends(nodes: Node[]): Node[] {
    const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));
    const resolvedMap = new Map<string, Node>();

    const resolveNode = (id: string, depth = 0): Node => {
      if (depth > 2) {
        throw new Error(`Inheritance depth limit exceeded (max 2 levels) for node: ${id}`);
      }

      if (resolvedMap.has(id)) {
        return resolvedMap.get(id)!;
      }

      const node = nodeMap.get(id);
      if (!node) {
        throw new Error(`Node not found to extend: ${id}`);
      }

      if (!node.extends) {
        resolvedMap.set(id, node);
        return node;
      }

      const parentNode = resolveNode(node.extends, depth + 1);

      // Merge constraints and tests
      const mergedConstraints = [...parentNode.constraints];
      for (const childC of node.constraints) {
        // Prevent duplicate constraints if merged already
        if (!mergedConstraints.some(c => c.description === childC.description)) {
          mergedConstraints.push(childC);
        }
      }

      const mergedTests = [...parentNode.tests];
      for (const childT of node.tests) {
        if (!mergedTests.some(t => t.name === childT.name)) {
          mergedTests.push(childT);
        }
      }

      const mergedNode: Node = {
        ...node,
        // If meta.path is not specified, inherit from parent
        meta: {
          path: node.meta.path || parentNode.meta.path,
          depends_on: Array.from(new Set([...node.meta.depends_on, ...parentNode.meta.depends_on]))
        },
        input: [...parentNode.input, ...node.input],
        output: [...parentNode.output, ...node.output],
        constraints: mergedConstraints,
        tests: mergedTests
      };

      resolvedMap.set(id, mergedNode);
      return mergedNode;
    };

    return nodes.map(node => resolveNode(node.id));
  }
}

export function validateProject(project: Project): void {
  for (const node of project.nodes) {
    if (node.output.length > 0 && node.type !== 'db-model' && node.type !== 'setup-command' && node.tests.length === 0) {
      throw new Error(`Validation Error: Node '${node.id}' has output fields defined, but is missing test cases.`);
    }

    if (node.input.length > 0) {
      for (const test of node.tests) {
        const given = test.given || {};

        for (const field of node.input) {
          if (field.required) {
            const inRoot = given[field.name] !== undefined;
            const inBody = given.body && typeof given.body === 'object' && given.body[field.name] !== undefined;
            const inQuery = given.query && typeof given.query === 'object' && given.query[field.name] !== undefined;
            const inHeaders = given.headers && typeof given.headers === 'object' && given.headers[field.name] !== undefined;

            if (!inRoot && !inBody && !inQuery && !inHeaders) {
              throw new Error(`Validation Error: Node '${node.id}' test '${test.name}' is missing required input field '${field.name}' in 'given'.`);
            }
          }
        }

        const allowedRootKeys = new Set(['method', 'headers', 'query', 'body']);
        const inputFieldNames = new Set(node.input.map(f => f.name));

        const checkKeys = (obj: any, locationName: string) => {
          if (!obj || typeof obj !== 'object') return;
          for (const key of Object.keys(obj)) {
            if (key.startsWith('@_')) continue;
            if (locationName === 'root' && allowedRootKeys.has(key)) continue;

            if (!inputFieldNames.has(key)) {
              throw new Error(`Validation Error: Node '${node.id}' test '${test.name}' specifies field '${key}' in given ${locationName} which is not declared in node inputs.`);
            }
          }
        };

        checkKeys(given, 'root');
        if (given.body && typeof given.body === 'object') {
          checkKeys(given.body, 'body');
        }
        if (given.query && typeof given.query === 'object') {
          checkKeys(given.query, 'query');
        }
      }
    }
  }
}
