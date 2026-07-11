import { type NodeProps, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProjectStore } from '../../../stores/index.js';
import type { NodeData } from '../../../types/index.js';
import { NODE_COLORS } from '../../../types/index.js';
import { DrawioEdge, ExtendsEdge } from './edges.js';
import { FileText, Link, FlaskConical } from 'lucide-react';

function GraphNode({ data }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const c = NODE_COLORS[nodeData.type] || { border: '#525252' };
  const status = useProjectStore(s => s.nodeStatuses[nodeData.id]);

  const deps = nodeData.meta.depends_on?.length || 0;
  const tests = nodeData.tests?.length || 0;
  const inputCount = nodeData.input?.length || 0;
  const outputCount = nodeData.output?.length || 0;
  const constraintCount = nodeData.constraints?.length || 0;
  const filename = nodeData.meta.path?.split('/').pop() || '';

  let accent = c.border || '#525252';
  let shadow = '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)';

  if (status === 'compiling') { accent = '#eab308'; shadow = '0 4px 20px rgba(234,179,8,0.12)'; }
  else if (status === 'done') { accent = '#22c55e'; shadow = '0 4px 20px rgba(34,197,94,0.12)'; }
  else if (status === 'error') { accent = '#ef4444'; shadow = '0 4px 20px rgba(239,68,68,0.12)'; }

  const handleStyle = {
    width: 10, height: 10, background: accent, border: '2px solid #0a0a0a', borderRadius: '50%',
  };

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 8, fontSize: 12,
      border: `1px solid ${accent}30`,
      minWidth: 220, maxWidth: 280, backgroundColor: '#111111',
      transition: 'all 0.2s ease',
      boxShadow: shadow,
      animation: status === 'compiling' ? 'pulse 1.5s ease-in-out infinite' : 'fadeIn 0.2s ease-out',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Left} id="t-top" style={{ ...handleStyle, top: '25%' }} />
      <Handle type="target" position={Position.Left} id="t-mid" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="target" position={Position.Left} id="t-bot" style={{ ...handleStyle, top: '75%' }} />
      <Handle type="source" position={Position.Right} id="s-top" style={{ ...handleStyle, top: '25%' }} />
      <Handle type="source" position={Position.Right} id="s-mid" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="s-bot" style={{ ...handleStyle, top: '75%' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 3, flexShrink: 0,
          background: accent,
          animation: status === 'compiling' ? 'spin 2s linear infinite' : 'none',
        }} />
        <span style={{ fontWeight: 700, color: '#e5e5e5', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nodeData.id}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        <Badge color={accent} text={nodeData.type} />
        {nodeData.flow && nodeData.flow !== 'default' && <Badge color="#a3a3a3" text={nodeData.flow} />}
        {nodeData.extends && <Badge color="#737373" text={`\u2191 ${nodeData.extends.split(':').pop()}`} />}
      </div>

      {filename && (
        <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 6, fontFamily: 'monospace', opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <FileText size={11} /> {filename}
        </div>
      )}

      {(inputCount > 0 || outputCount > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#737373', marginBottom: 6 }}>
          {inputCount > 0 && <span style={{ background: '#171717', padding: '2px 8px', borderRadius: 4, border: '1px solid #1f1f1f' }}>in {inputCount}</span>}
          {inputCount > 0 && outputCount > 0 && <span style={{ color: '#404040' }}>{"\u2192"}</span>}
          {outputCount > 0 && <span style={{ background: '#171717', padding: '2px 8px', borderRadius: 4, border: '1px solid #1f1f1f' }}>out {outputCount}</span>}
        </div>
      )}

      {constraintCount > 0 && (
        <div style={{
          fontSize: 11, color: '#a3a3a3', lineHeight: 1.5,
          padding: '6px 10px', background: '#0a0a0a', borderRadius: 4,
          borderLeft: `3px solid #eab308`,
        }}>
          {nodeData.constraints.slice(0, 2).map((c, i) => (
            <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>
          ))}
          {constraintCount > 2 && <div style={{ color: '#404040', fontSize: 10 }}>+{constraintCount - 2} more</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, color: '#404040' }}>
        {deps > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Link size={10} /> {deps}</span>}
        {tests > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}><FlaskConical size={10} /> {tests}</span>}
      </div>
    </div>
  );
}

function Badge({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
      background: `${color}12`, color: color, border: `1px solid ${color}25`,
    }}>
      {text}
    </span>
  );
}

export function getNodeTypes(nodes: any[]): Record<string, any> {
  const types: Record<string, any> = {};
  for (const n of nodes) { const t = n.type || n.data?.type; if (t && !types[t]) types[t] = GraphNode; }
  for (const t of ['api-route','ui-component','db-model','middleware','config-file','setup-command']) types[t] = GraphNode;
  return types;
}

export const pxmlEdgeTypes = { dependency: DrawioEdge, extends: ExtendsEdge };
