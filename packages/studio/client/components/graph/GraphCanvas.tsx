import { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Controls, MiniMap, Background, useReactFlow } from '@xyflow/react';
import { pxmlEdgeTypes, getNodeTypes } from './nodes/index.js';
import { useProjectStore, useOutputStore } from '../../stores/index.js';
import { NodeEditDialog } from '../dialogs/NodeEditDialog.js';
import type { NodeType } from '../../types/index.js';
import { NODE_COLORS } from '../../types/index.js';
import { FolderOpen, Link, FileText, Plus } from 'lucide-react';

const NODE_TYPE_LIST: { type: NodeType; label: string; color: string }[] = [
  { type: 'api-route', label: 'API Route', color: NODE_COLORS['api-route'].border },
  { type: 'ui-component', label: 'UI Component', color: NODE_COLORS['ui-component'].border },
  { type: 'db-model', label: 'DB Model', color: NODE_COLORS['db-model'].border },
  { type: 'middleware', label: 'Middleware', color: NODE_COLORS['middleware'].border },
  { type: 'config-file', label: 'Config File', color: NODE_COLORS['config-file'].border },
  { type: 'setup-command', label: 'Setup Command', color: NODE_COLORS['setup-command'].border },
];

export function GraphCanvas() {
  const nodes = useProjectStore(s => s.nodes);
  const edges = useProjectStore(s => s.edges);
  const workspacePath = useProjectStore(s => s.workspacePath);
  const project = useProjectStore(s => s.project);
  const onNodesChange = useProjectStore(s => s.onNodesChange);
  const onEdgesChange = useProjectStore(s => s.onEdgesChange);
  const onConnect = useProjectStore(s => s.onConnect);
  const setSelectedNode = useProjectStore(s => s.setSelectedNode);
  const addNode = useProjectStore(s => s.addNode);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [paneContextMenu, setPaneContextMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (nodes.length > 0) setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
  }, [workspacePath]);

  function onNodeContextMenu(e: React.MouseEvent, node: any) {
    e.preventDefault();
    setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
    setPaneContextMenu(null);
  }

  function onPaneContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setPaneContextMenu({ x: e.clientX, y: e.clientY, flowX: pos.x, flowY: pos.y });
    setNodeContextMenu(null);
  }

  function createNode(type: NodeType, flowX: number, flowY: number) {
    const id = addNode(type, { x: flowX, y: flowY });
    setPaneContextMenu(null);
    setEditNodeId(id);
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/node-type') as NodeType;
    if (!type) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(type, { x: pos.x, y: pos.y });
  }

  return (
    <div style={{ width: '100%', height: '100%' }} onDragOver={onDragOver} onDrop={onDrop}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97) translateY(3px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .react-flow__background { background: #0a0a0a !important; }
        .react-flow__controls {
          border-radius: 6px; overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
          border: 1px solid #1f1f1f !important;
        }
        .react-flow__controls-button {
          background: #111111 !important; border: none !important;
          border-bottom: 1px solid #1f1f1f !important;
          fill: #a3a3a3 !important; width: 28px !important; height: 28px !important;
        }
        .react-flow__controls-button:hover {
          background: #171717 !important; fill: #e5e5e5 !important;
        }
        .react-flow__minimap {
          border-radius: 6px; border: 1px solid #1f1f1f !important;
          background: #0a0a0a !important; overflow: hidden;
        }
        .react-flow__attribution { display: none !important; }
      `}</style>
      <ReactFlow
        key={workspacePath || 'no-project'}
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onNodeClick={(_e, node) => setSelectedNode(node.id)}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={(e, edge) => { e.preventDefault(); setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: edge.id }); }}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => { setSelectedNode(null); setNodeContextMenu(null); setPaneContextMenu(null); }}
        nodeTypes={getNodeTypes(nodes)} edgeTypes={pxmlEdgeTypes}
        defaultEdgeOptions={{ type: 'dependency', selectable: true, focusable: true, deletable: true }}
        connectionLineStyle={{ stroke: '#404040', strokeWidth: 1.5 }}
        fitView minZoom={0.1} maxZoom={2} edgesFocusable={true}
        connectOnClick={false} panOnDrag={[1, 2]} proOptions={{ hideAttribution: true }}
        style={{ background: '#0a0a0a' }}
      >
        {nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ textAlign: 'center', color: '#525252', fontSize: 14 }}>
              {!workspacePath ? (
                <>
                  <div style={{ marginBottom: 16, opacity: 0.4, display: 'flex', justifyContent: 'center' }}><FolderOpen size={48} strokeWidth={1} /></div>
                  <div style={{ color: '#737373', fontWeight: 500 }}>Open a pxml project to get started</div>
                  <div style={{ fontSize: 11, marginTop: 6, color: '#404040' }}>Ctrl+O or click Open Folder</div>
                </>
              ) : !project ? (
                <div style={{ fontSize: 24, marginBottom: 8 }}>Loading...</div>
              ) : nodes.length === 0 && edges.length > 0 ? (
                <>
                  <div style={{ marginBottom: 12, opacity: 0.4, display: 'flex', justifyContent: 'center' }}><Link size={32} strokeWidth={1} /></div>
                  <div style={{ color: '#737373' }}>Edges only {"\u2014"} right-click to add a node</div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 16, opacity: 0.4, display: 'flex', justifyContent: 'center' }}><FileText size={48} strokeWidth={1} /></div>
                  <div style={{ color: '#737373', fontWeight: 500 }}>No nodes in project</div>
                  <div style={{ fontSize: 11, marginTop: 6, color: '#404040' }}>Right-click canvas or drag from sidebar</div>
                </>
              )}
            </div>
          </div>
        )}
        <Controls style={{ background: 'transparent' }} />
        <MiniMap style={{ background: '#0a0a0a' }} />
        <Background color="#1f1f1f" gap={20} size={1} />
      </ReactFlow>

      {nodeContextMenu && (
        <NodeContextMenu x={nodeContextMenu.x} y={nodeContextMenu.y} nodeId={nodeContextMenu.nodeId}
          onClose={() => setNodeContextMenu(null)} onEdit={(id) => { setEditNodeId(id); setNodeContextMenu(null); }} />
      )}
      {paneContextMenu && (
        <PaneContextMenu x={paneContextMenu.x} y={paneContextMenu.y}
          onClose={() => setPaneContextMenu(null)}
          onCreate={(type) => createNode(type, paneContextMenu.flowX, paneContextMenu.flowY)} />
      )}
      {editNodeId && <NodeEditDialog nodeId={editNodeId} onClose={() => setEditNodeId(null)} />}
    </div>
  );
}

function PaneContextMenu({ x, y, onClose, onCreate }: {
  x: number; y: number; onClose: () => void; onCreate: (type: NodeType) => void;
}) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 101,
        background: '#171717', border: '1px solid #262626',
        borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 180, padding: '4px 0', animation: 'fadeIn 0.12s ease-out',
      }}>
        <div style={{ padding: '6px 12px 8px', fontSize: 11, color: '#525252', borderBottom: '1px solid #1f1f1f', marginBottom: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={12} /> New Node
        </div>
        {NODE_TYPE_LIST.map((nt) => (
          <button key={nt.type} onClick={() => onCreate(nt.type)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            textAlign: 'left', padding: '6px 12px', fontSize: 12, color: '#a3a3a3',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1c1c1c')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ width: 8, height: 8, borderRadius: 3, flexShrink: 0, background: nt.color }} />
            {nt.label}
          </button>
        ))}
      </div>
    </>
  );
}

function NodeContextMenu({ x, y, nodeId, onClose, onEdit }: {
  x: number; y: number; nodeId: string; onClose: () => void; onEdit: (id: string) => void;
}) {
  const removeNode = useProjectStore(s => s.removeNode);
  const append = useOutputStore(s => s.append);
  const workspacePath = useProjectStore(s => s.workspacePath);

  async function runTest() {
    if (!workspacePath) return; onClose();
    append({ type: 'info', message: `Running test for ${nodeId}...` });
    const res = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: workspacePath, nodeId }) });
    const d = await res.json();
    append({ type: d.passed ? 'success' : 'error', message: d.message || 'Done.' });
  }

  async function runFix() {
    if (!workspacePath) return; onClose();
    append({ type: 'info', message: `Starting fix for ${nodeId}...` });
    await fetch('/api/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: workspacePath, nodeId }) });
  }

  const items: { label: string; action: () => void; danger?: boolean; highlight?: boolean }[] = [
    { label: 'Edit Details', action: () => onEdit(nodeId), highlight: true },
    { label: 'Run Test', action: runTest },
    { label: 'Self-Heal', action: runFix },
    { label: '---', action: () => {} },
    { label: 'Delete Node', action: () => { removeNode(nodeId); onClose(); }, danger: true },
  ];

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 101,
        background: '#171717', border: '1px solid #262626',
        borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 180, padding: '4px 0', animation: 'fadeIn 0.12s ease-out',
      }}>
        <div style={{ padding: '6px 12px 8px', fontSize: 11, color: '#525252', borderBottom: '1px solid #1f1f1f', marginBottom: 4, fontWeight: 600 }}>
          {nodeId}
        </div>
        {items.map((item, i) => (
          item.label === '---' ? (
            <div key={i} style={{ borderTop: '1px solid #1f1f1f', margin: '4px 0' }} />
          ) : (
            <button key={i} onClick={item.action} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '5px 12px',
              fontSize: 12, fontWeight: item.highlight ? 600 : 400,
              color: item.danger ? '#ef4444' : item.highlight ? '#e5e5e5' : '#a3a3a3',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1c1c1c')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >{item.label}</button>
          )
        ))}
      </div>
    </>
  );
}
