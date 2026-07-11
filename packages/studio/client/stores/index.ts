import { create } from 'zustand';
import type { NodeData, ProjectData, ImportData, NodeType, XYPosition } from '../types/index.js';
import { createDefaultNodeData, projectToGraph, graphToXml, nextNodeId, layoutNodes } from '../utils/xml-serializer.js';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node<NodeData>[];
  edges: Edge[];
  imports: ImportData[];
  project: ProjectData | null;
}

interface ProjectStore {
  project: ProjectData | null;
  nodes: Node<NodeData>[];
  edges: Edge[];
  imports: ImportData[];
  workspacePath: string | null;
  isDirty: boolean;
  selectedNodeId: string | null;
  nodeStatuses: Record<string, 'pending' | 'compiling' | 'done' | 'error'>;
  packageNodes: NodeData[];
  _history: Snapshot[];
  _historyIdx: number;

  openProject: (path: string) => Promise<void>;
  saveProject: () => Promise<void>;
  exportXml: () => Promise<string | undefined>;
  addNode: (type: NodeType, position: XYPosition) => string;
  removeNode: (id: string) => void;
  updateNode: (id: string, patch: Partial<NodeData>) => void;
  updateNodeMeta: (id: string, meta: Partial<NodeData['meta']>) => void;
  addConnection: (sourceId: string, targetId: string) => void;
  removeConnection: (edgeId: string) => void;
  setExtends: (nodeId: string, parentId: string | null) => void;
  addImport: (imp: ImportData) => void;
  removeImport: (as: string) => void;
  setSelectedNode: (id: string | null) => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  relayout: () => void;
  setNodeStatus: (id: string, status: 'pending' | 'compiling' | 'done' | 'error') => void;
  clearNodeStatuses: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  saveLayout: () => void;
  resetLayout: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  nodes: [],
  edges: [],
  imports: [],
  workspacePath: null,
  isDirty: false,
  selectedNodeId: null,
  nodeStatuses: {},
  packageNodes: [],
  _history: [],
  _historyIdx: -1,

  openProject: async (path: string) => {
    const res = await fetch('/api/project/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    console.log('[STUDIO] Project loaded:', data.project?.name, 'nodes:', data.nodes?.length);
    const { rfNodes, rfEdges, packageNodes } = projectToGraph(data.project, data.nodes, data.imports);

    // Load saved layout positions
    try {
      const layoutRes = await fetch(`/api/layout/load?path=${encodeURIComponent(path)}`);
      const layoutData = await layoutRes.json();
      if (layoutData.positions) {
        for (const node of rfNodes) {
          const saved = layoutData.positions[node.id];
          if (saved) node.position = saved;
        }
      }
    } catch {}

    console.log('[STUDIO] Graph built:', rfNodes.length, 'nodes,', rfEdges.length, 'edges,', packageNodes.length, 'package nodes');
    set({
      project: data.project,
      nodes: rfNodes,
      edges: rfEdges,
      imports: data.imports,
      packageNodes,
      workspacePath: path,
      isDirty: false,
      selectedNodeId: null,
      nodeStatuses: {},
      _history: [],
      _historyIdx: -1,
    });
    try { localStorage.setItem('pxml-workspace', path); } catch {}
  },

  saveProject: async () => {
    const { project, nodes, imports, workspacePath } = get();
    if (!project || !workspacePath) return;
    const nodeData = nodes.map(n => n.data);
    const xml = graphToXml(project, nodeData, imports);
    const res = await fetch('/api/project/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath, xml }),
    });
    if (!res.ok) throw new Error(await res.text());
    set({ isDirty: false });
  },

  exportXml: async () => {
    const { project, nodes, imports, workspacePath } = get();
    if (!project || !workspacePath) return;
    const nodeData = nodes.map(n => n.data);
    const xml = graphToXml(project, nodeData, imports);
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath, xml }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.path;
  },

  addNode: (type: NodeType, position: XYPosition) => {
    const { nodes, project } = get();
    get().pushHistory();
    const id = nextNodeId(nodes.map(n => n.data));
    const data = createDefaultNodeData(type, id);
    const newNode: Node<NodeData> = {
      id,
      type,
      position,
      data,
    };
    set({ nodes: [...nodes, newNode], isDirty: true, selectedNodeId: id });
    return id;
  },

  removeNode: (id: string) => {
    const { nodes, edges, selectedNodeId } = get();
    get().pushHistory();
    set({
      nodes: nodes.filter(n => n.id !== id).map(n => ({
        ...n,
        data: {
          ...n.data,
          meta: {
            ...n.data.meta,
            depends_on: n.data.meta.depends_on.filter(d => d !== id),
          },
          extends: n.data.extends === id ? undefined : n.data.extends,
        },
      })),
      edges: edges.filter(e => e.source !== id && e.target !== id),
      isDirty: true,
      selectedNodeId: selectedNodeId === id ? null : selectedNodeId,
    });
  },

  updateNode: (id: string, patch: Partial<NodeData>) => {
    const { nodes } = get();
    set({
      nodes: nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      ),
      isDirty: true,
    });
  },

  updateNodeMeta: (id: string, meta: Partial<NodeData['meta']>) => {
    const { nodes } = get();
    set({
      nodes: nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, meta: { ...n.data.meta, ...meta } } } : n
      ),
      isDirty: true,
    });
  },

  addConnection: (sourceId: string, targetId: string) => {
    const { nodes, edges } = get();
    if (edges.find(e => e.source === sourceId && e.target === targetId)) return;
    get().pushHistory();

    // Assign next available handle based on existing connections
    const existingTarget = edges.filter(e => e.target === targetId).length;
    const existingSource = edges.filter(e => e.source === sourceId).length;
    const tIdx = existingTarget % 3;
    const sIdx = existingSource % 3;
    const th = tIdx === 0 ? 't-top' : tIdx === 1 ? 't-mid' : 't-bot';
    const sh = sIdx === 0 ? 's-top' : sIdx === 1 ? 's-mid' : 's-bot';
    if (edges.find(e => e.source === sourceId && e.target === targetId)) return;
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return;

    set({
      nodes: nodes.map(n =>
        n.id === targetId
          ? {
              ...n,
              data: {
                ...n.data,
                meta: {
                  ...n.data.meta,
                  depends_on: [...n.data.meta.depends_on, sourceId],
                },
              },
            }
          : n
      ),
      edges: [
        ...edges,
        {
          id: `${sourceId}->${targetId}`,
          source: sourceId,
          target: targetId,
          sourceHandle: sh,
          targetHandle: th,
          type: 'dependency',
          style: { stroke: '#64748b', strokeWidth: 2 },
        } as Edge,
      ],
      isDirty: true,
    });
  },

  removeConnection: (edgeId: string) => {
    const { nodes, edges } = get();
    get().pushHistory();
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    set({
      nodes: nodes.map(n =>
        n.id === edge.target
          ? {
              ...n,
              data: {
                ...n.data,
                meta: {
                  ...n.data.meta,
                  depends_on: n.data.meta.depends_on.filter(d => d !== edge.source),
                },
              },
            }
          : n
      ),
      edges: edges.filter(e => e.id !== edgeId),
      isDirty: true,
    });
  },

  setExtends: (nodeId: string, parentId: string | null) => {
    const { nodes, edges } = get();
    const extEdgeId = `${nodeId}--extends-->${parentId}`;

    set({
      nodes: nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, extends: parentId || undefined } } : n
      ),
      edges: parentId
        ? [...edges.filter(e => !e.id.startsWith(`${nodeId}--extends`)), {
            id: extEdgeId,
            source: nodeId,
            target: parentId,
            type: 'extends',
            style: { stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '5 5' },
          } as Edge]
        : edges.filter(e => !e.id.startsWith(`${nodeId}--extends`)),
      isDirty: true,
    });
  },

  addImport: (imp: ImportData) => {
    const { imports } = get();
    if (imports.find(i => i.as === imp.as)) return;
    set({ imports: [...imports, imp], isDirty: true });
  },

  removeImport: (as: string) => {
    set({ imports: get().imports.filter(i => i.as !== as), isDirty: true });
  },

  setSelectedNode: (id: string | null) => {
    set({ selectedNodeId: id });
  },

  onNodesChange: (changes: any) => {
    const { nodes } = get();
    const updated = [...nodes];
    let posChanged = false;
    for (const change of changes) {
      if (change.type === 'position') {
        const idx = updated.findIndex(n => n.id === change.id);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], position: change.position };
          posChanged = true;
        }
      }
    }
    set({ nodes: updated, isDirty: true });
    if (posChanged) {
      clearTimeout((get() as any)._saveTimer);
      (get() as any)._saveTimer = setTimeout(() => get().saveLayout(), 1000);
    }
  },

  onEdgesChange: (changes: any) => {
    const { edges } = get();
    const updated = [...edges];
    for (const change of changes) {
      if (change.type === 'remove') {
        const idx = updated.findIndex(e => e.id === change.id);
        if (idx >= 0) updated.splice(idx, 1);
      }
    }
    set({ edges: updated, isDirty: true });
  },

  onConnect: (connection: any) => {
    const { addConnection } = get();
    addConnection(connection.source, connection.target);
  },
  // Note: multi-handle connections are managed automatically; sourceHandle/targetHandle
  // from the connection event are used directly by ReactFlow on edge creation.
  // For manual connect (drag from handle), ReactFlow passes the handle IDs automatically.
  // We handle the case where it's a default connect (no handles) in addConnection.

  relayout: () => {
    const { nodes } = get();
    get().pushHistory();
    const posMap = layoutNodes(nodes.map(n => n.data));
    set({
      nodes: nodes.map(n => {
        const pos = posMap.get(n.id);
        return pos ? { ...n, position: pos } : n;
      }),
      isDirty: true,
    });
  },

  setNodeStatus: (id, status) => set(s => ({
    nodeStatuses: { ...s.nodeStatuses, [id]: status },
  })),

  clearNodeStatuses: () => set({ nodeStatuses: {} }),

  pushHistory: () => {
    const { nodes, edges, imports, project, _history, _historyIdx } = get();
    const snap: Snapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      imports: JSON.parse(JSON.stringify(imports)),
      project: project ? JSON.parse(JSON.stringify(project)) : null,
    };
    const newHistory = _history.slice(0, _historyIdx + 1);
    newHistory.push(snap);
    if (newHistory.length > 50) newHistory.shift();
    set({ _history: newHistory, _historyIdx: newHistory.length - 1 });
  },

  undo: () => {
    const { _history, _historyIdx } = get();
    if (_historyIdx <= 0) return;
    const idx = _historyIdx - 1;
    const snap = _history[idx];
    set({
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      imports: JSON.parse(JSON.stringify(snap.imports)),
      project: snap.project ? JSON.parse(JSON.stringify(snap.project)) : null,
      _historyIdx: idx,
      isDirty: true,
    });
  },

  redo: () => {
    const { _history, _historyIdx } = get();
    if (_historyIdx >= _history.length - 1) return;
    const idx = _historyIdx + 1;
    const snap = _history[idx];
    set({
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      imports: JSON.parse(JSON.stringify(snap.imports)),
      project: snap.project ? JSON.parse(JSON.stringify(snap.project)) : null,
      _historyIdx: idx,
      isDirty: true,
    });
  },

  saveLayout: () => {
    const { nodes, workspacePath } = get();
    if (!workspacePath) return;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      positions[n.id] = { x: n.position.x, y: n.position.y };
    }
    fetch('/api/layout/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath, positions }),
    }).catch(() => {});
  },

  resetLayout: () => {
    const { nodes, workspacePath } = get();
    get().pushHistory();
    const posMap = layoutNodes(nodes.map(n => n.data));
    set({
      nodes: nodes.map(n => {
        const pos = posMap.get(n.id);
        return pos ? { ...n, position: pos } : n;
      }),
      isDirty: true,
    });
    if (workspacePath) {
      fetch('/api/layout/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: workspacePath, positions: {} }),
      }).catch(() => {});
    }
  },
}));

interface UIStore {
  theme: 'dark' | 'light';
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  leftPanelOpen: boolean;
  bottomPanelHeight: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
  propertyPanelTab: 'basic' | 'fields' | 'constraints' | 'tests' | 'images' | 'meta';
  toggleTheme: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  toggleLeftPanel: () => void;
  setBottomPanelHeight: (h: number) => void;
  setLeftPanelWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  setPropertyPanelTab: (tab: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'dark',
  rightPanelOpen: true,
  bottomPanelOpen: true,
  leftPanelOpen: true,
  bottomPanelHeight: 250,
  leftPanelWidth: 280,
  rightPanelWidth: 340,
  propertyPanelTab: 'basic',
  toggleTheme: () => set(s => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.className = next;
    return { theme: next };
  }),
  toggleRightPanel: () => set(s => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleBottomPanel: () => set(s => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  toggleLeftPanel: () => set(s => ({ leftPanelOpen: !s.leftPanelOpen })),
  setBottomPanelHeight: (h: number) => set({ bottomPanelHeight: h }),
  setLeftPanelWidth: (w: number) => set({ leftPanelWidth: Math.max(180, Math.min(500, w)) }),
  setRightPanelWidth: (w: number) => set({ rightPanelWidth: Math.max(240, Math.min(600, w)) }),
  setPropertyPanelTab: (tab: string) => set({ propertyPanelTab: tab as any }),
}));

interface OutputStore {
  lines: { timestamp: number; type: string; message: string; nodeId?: string }[];
  isCompiling: boolean;
  costSummary: { inputTokens: number; outputTokens: number; cachedTokens: number } | null;
  append: (line: { type: string; message: string; nodeId?: string }) => void;
  clear: () => void;
  setCompiling: (v: boolean) => void;
  setCostSummary: (s: { inputTokens: number; outputTokens: number; cachedTokens: number } | null) => void;
}

export const useOutputStore = create<OutputStore>((set) => ({
  lines: [],
  isCompiling: false,
  costSummary: null,
  append: (line) => set(s => ({
    lines: [...s.lines, { ...line, timestamp: Date.now() }],
  })),
  clear: () => set({ lines: [], costSummary: null }),
  setCompiling: (v) => set({ isCompiling: v }),
  setCostSummary: (s) => set({ costSummary: s }),
}));
