import type { NodeData, ProjectData, ImportData, XYPosition, NodeType } from '../types/index.js';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function createDefaultNodeData(type: NodeType, id: string): NodeData {
  return {
    id, type, flow: 'default', autogenTests: true,
    meta: { path: '', depends_on: [] },
    input: [], output: [], constraints: [], tests: [],
  };
}

export function projectToGraph(
  project: ProjectData, nodes: NodeData[], imports: ImportData[]
): { rfNodes: any[]; rfEdges: any[]; packageNodes: NodeData[] } {
  const packageAliases = new Set(imports.filter(i => i.package || i.from).map(i => i.as));
  const isHidden = (n: NodeData) => {
    const prefix = n.id.split(':')[0];
    return packageAliases.has(prefix) && n.id.includes(':');
  };
  const mainNodes = nodes.filter(n => !isHidden(n));
  const packageNodes = nodes.filter(n => isHidden(n));
  const rfNodes: any[] = [];
  const rfEdges: any[] = [];
  const posMap = layoutNodes(mainNodes);

  for (const node of mainNodes) {
    const pos = posMap.get(node.id) || { x: 0, y: 0 };
    rfNodes.push({ id: node.id, type: node.type, position: pos, data: { ...node } });
  }
  for (const node of mainNodes) {
    const depCount = node.meta.depends_on.length;
    node.meta.depends_on.forEach((dep, idx) => {
      const targetConnections = mainNodes.filter(n => n.meta.depends_on.includes(node.id)).length;
      const sourceConnections = depCount;

      const targetHandleIdx = idx % 3;
      const targetHandle = targetHandleIdx === 0 ? 't-top' : targetHandleIdx === 1 ? 't-mid' : 't-bot';

      const srcNode = mainNodes.find(n => n.id === dep);
      const srcConnIdx = srcNode ? srcNode.meta.depends_on.indexOf(node.id) % 3 : 0;
      const sourceHandle = srcConnIdx === 0 ? 's-top' : srcConnIdx === 1 ? 's-mid' : 's-bot';

      rfEdges.push({
        id: `${node.id}->${dep}`,
        source: dep,
        target: node.id,
        sourceHandle: targetHandleIdx === 0 ? 's-top' : targetHandleIdx === 1 ? 's-mid' : 's-bot',
        targetHandle,
        type: 'dependency',
        style: { stroke: '#64748b', strokeWidth: 2 },
      });
    });
    if (node.extends) {
      rfEdges.push({ id: `${node.id}--extends-->${node.extends}`, source: node.id, target: node.extends, type: 'extends', style: { stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '5 5' } });
    }
  }
  return { rfNodes, rfEdges, packageNodes };
}

export function graphToXml(project: ProjectData, nodes: NodeData[], imports: ImportData[]): string {
  const importsXml = imports.map(imp => {
    const attrs: string[] = [];
    if (imp.src) attrs.push(`src="${imp.src}"`);
    if (imp.package) attrs.push(`package="${imp.package}"`);
    if (imp.from) attrs.push(`from="${imp.from}"`);
    attrs.push(`as="${imp.as}"`);
    return `  <import ${attrs.join(' ')} />`;
  }).join('\n');
  const nodesXml = nodes.map(n => {
    const attrs = [`id="${escapeXml(n.id)}"`, `type="${escapeXml(n.type)}"`, `flow="${escapeXml(n.flow)}"`];
    if (n.extends) attrs.push(`extends="${escapeXml(n.extends)}"`);
    if (!n.autogenTests) attrs.push(`autogen-tests="false"`);
    const metaChildren = [`      <path>${escapeXml(n.meta.path)}</path>`];
    for (const dep of n.meta.depends_on) metaChildren.push(`      <depends_on>${dep}</depends_on>`);
    const meta = `    <meta>\n${metaChildren.join('\n')}\n    </meta>`;
    const input = n.input.length > 0 ? `    <input>\n${n.input.map(f => `        <field name="${f.name}" type="${f.type}"${!f.required ? ' required="false"' : ''}${f.format ? ` format="${f.format}"` : ''} />`).join('\n')}\n    </input>\n` : '';
    const output = n.output.length > 0 ? `    <output>\n${n.output.map(f => `        <field name="${f.name}" type="${f.type}"${!f.required ? ' required="false"' : ''}${f.format ? ` format="${f.format}"` : ''} />`).join('\n')}\n    </output>\n` : '';
    const constraintsXml = n.constraints.map(c => `    <constraint verify="${c.verify}"${c.learnedFrom ? ` learned-from="${c.learnedFrom}"` : ''}>${escapeXml(c.description)}</constraint>`).join('\n');
    const testsXml = n.tests.map(t => {
      const g: any = t.given || {};
      const e: any = t.expect || {};

      const givenParts: string[] = [];
      if (g.method) givenParts.push(` method="${g.method}"`);
      if (g.headers && typeof g.headers === 'string') givenParts.push(` headers="${escapeXml(g.headers)}"`);

      const bodyObj = g.body;
      const queryObj = g.query;

      const givenChildren: string[] = [];

      if (queryObj && typeof queryObj === 'object') {
        for (const [k, v] of Object.entries(queryObj)) {
          givenChildren.push(`        <${k}>${escapeXml(String(v))}</${k}>`);
        }
      }

      if (bodyObj && typeof bodyObj === 'object') {
        const isJson = bodyObj['@_json'] === true || bodyObj['@_json'] === 'true';
        const bodyTag = isJson ? '<body json="true">' : '<body>';
        const bodyItems: string[] = [];
        for (const [k, v] of Object.entries(bodyObj)) {
          if (k === '@_json') continue;
          bodyItems.push(`          <${k}>${escapeXml(String(v))}</${k}>`);
        }
        if (bodyItems.length > 0) {
          givenChildren.push(`        ${bodyTag}`);
          givenChildren.push(...bodyItems);
          givenChildren.push('        </body>');
        }
      }

      const givenXml = givenChildren.length > 0
        ? `      <given${givenParts.join('')}>\n${givenChildren.join('\n')}\n      </given>`
        : `      <given${givenParts.length > 0 ? givenParts.join('') : ''} />`;

      const expectParts: string[] = [];
      if (e.status != null) expectParts.push(`        <status>${e.status}</status>`);
      if (e.contains) expectParts.push(`        <contains>${escapeXml(String(e.contains))}</contains>`);
      if (e.match) expectParts.push(`        <match>${escapeXml(String(e.match))}</match>`);
      if (e.body) expectParts.push(`        <body>${typeof e.body === 'object' ? escapeXml(JSON.stringify(e.body)) : escapeXml(String(e.body))}</body>`);
      if (e.field) expectParts.push(`        <field>${escapeXml(String(e.field))}</field>`);

      const expectXml = expectParts.length > 0
        ? `      <expect>\n${expectParts.join('\n')}\n      </expect>`
        : `      <expect />`;

      return `    <test>\n      <name>${escapeXml(t.name)}</name>\n${givenXml}\n${expectXml}\n    </test>`;
    }).join('\n');
    let body = meta;
    if (input) body += `\n${input}`;
    if (output) body += `\n${output}`;
    if (constraintsXml) body += `\n${constraintsXml}`;
    if (testsXml) body += `\n${testsXml}`;
    return `  <node ${attrs.join(' ')}>\n${body}\n  </node>`;
  }).join('\n\n');
  return `<project name="${project.name}" stack="${project.stack}" version="${project.version}" autogen-tests="${project.autogenTests}"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="pxml.xsd">
${importsXml ? importsXml + '\n\n' : ''}${nodesXml}
</project>
`;
}

export function nextNodeId(nodes: NodeData[], prefix = 'new.node'): string {
  for (let i = 1; i < 1000; i++) {
    const id = `${prefix}${i}`;
    if (!nodes.find(n => n.id === id)) return id;
  }
  return `${prefix}_${Date.now()}`;
}

export function layoutNodes(nodes: NodeData[]): Map<string, XYPosition> {
  const posMap = new Map<string, XYPosition>();
  if (nodes.length === 0) return posMap;

  // Build adjacency for child/parent relationships
  const nodeSet = new Set(nodes.map(n => n.id));
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const n of nodes) { children.set(n.id, []); parents.set(n.id, []); }
  for (const n of nodes) {
    for (const dep of n.meta.depends_on) {
      if (nodeSet.has(dep)) {
        children.get(dep)!.push(n.id);
        parents.get(n.id)!.push(dep);
      }
    }
  }

  // Find connected components
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const comp: string[] = [];
    const stack = [n.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      comp.push(id);
      for (const c of children.get(id) || []) stack.push(c);
      for (const p of parents.get(id) || []) stack.push(p);
    }
    components.push(comp);
  }

  const X = 340, Y = 240;
  let globalX = -200;

  for (const comp of components) {
    const compSet = new Set(comp);

    // BFS layer assignment: root nodes = layer 0, children = parent layer + 1
    const layer = new Map<string, number>();
    const q: string[] = [];
    for (const id of comp) {
      const pcount = (parents.get(id) || []).filter(p => compSet.has(p)).length;
      if (pcount === 0) { q.push(id); layer.set(id, 0); }
    }
    while (q.length) {
      const id = q.shift()!;
      const cl = layer.get(id)!;
      for (const c of children.get(id) || []) {
        if (!compSet.has(c)) continue;
        const nl = cl + 1;
        if (!layer.has(c) || layer.get(c)! < nl) layer.set(c, nl);
        q.push(c);
      }
    }

    // Group by layer
    const groups = new Map<number, string[]>();
    for (const id of comp) {
      const l = layer.get(id) ?? 999;
      if (!groups.has(l)) groups.set(l, []);
      groups.get(l)!.push(id);
    }

    // Sort children by parent positions for clean layout
    for (const [l, ids] of groups) {
      if (l > 0) {
        ids.sort((a, b) => {
          const pa = (parents.get(a) || []).filter(p => compSet.has(p));
          const pb = (parents.get(b) || []).filter(p => compSet.has(p));
          const ax = pa[0] ? (posMap.get(pa[0])?.x ?? 0) : 0;
          const bx = pb[0] ? (posMap.get(pb[0])?.x ?? 0) : 0;
          return ax - bx;
        });
      }
      groups.set(l, ids);
    }

    // Compute width per layer
    const layerWidths = new Map<number, number>();
    for (const [l, ids] of groups) layerWidths.set(l, (ids.length - 1) * X);
    const compW = Math.max(...Array.from(layerWidths.values(), w => w > 0 ? w : 200));

    // Place nodes
    for (const [l, ids] of groups) {
      const tw = layerWidths.get(l)!;
      const sx = globalX + (compW - tw) / 2;
      ids.forEach((id, i) => {
        posMap.set(id, { x: sx + i * X, y: l * Y });
      });
    }
    globalX += compW + 120;
  }

  // Isolated nodes in grid at bottom
  const isolated = nodes.filter(n => !posMap.has(n.id));
  if (isolated.length > 0) {
    const maxY = posMap.size > 0 ? Math.max(...Array.from(posMap.values(), p => p.y)) + Y : 0;
    const COLS = 5;
    const rows = Math.ceil(isolated.length / COLS);
    for (let r = 0; r < rows; r++) {
      const rowIds = isolated.slice(r * COLS, (r + 1) * COLS);
      const tw = (rowIds.length - 1) * X;
      rowIds.forEach((n, i) => {
        posMap.set(n.id, { x: -tw / 2 + i * X, y: maxY + r * Y });
      });
    }
  }

  return posMap;
}
