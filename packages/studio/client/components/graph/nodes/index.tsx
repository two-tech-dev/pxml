import { type NodeProps, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProjectStore } from '../../../stores/index.js';
import type { NodeData } from '../../../types/index.js';
import { NODE_COLORS } from '../../../types/index.js';
import { DrawioEdge, ExtendsEdge } from './edges.js';

function GraphNode({ data }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const c = NODE_COLORS[nodeData.type] || { border: '#858585' };
  const status = useProjectStore(s => s.nodeStatuses[nodeData.id]);

  const deps = nodeData.meta.depends_on?.length || 0;
  const tests = nodeData.tests?.length || 0;
  const inputCount = nodeData.input?.length || 0;
  const outputCount = nodeData.output?.length || 0;
  const constraintCount = nodeData.constraints?.length || 0;
  const filename = nodeData.meta.path?.split('/').pop() || '';

  let accent = c.border || '#858585';
  let accentBg = `${accent}15`;
  let shadow = '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)';

  if (status === 'compiling') { accent = '#cca700'; accentBg = 'rgba(204,167,0,0.15)'; shadow = '0 4px 16px rgba(204,167,0,0.2)'; }
  else if (status === 'done') { accent = '#89d185'; accentBg = 'rgba(137,209,133,0.15)'; }
  else if (status === 'error') { accent = '#f44747'; accentBg = 'rgba(244,71,71,0.15)'; shadow = '0 4px 16px rgba(244,71,71,0.2)'; }

  const handleStyle = {
    width: 10, height: 10, background: accent, border: '2px solid #1e1e1e', borderRadius: '50%',
    transition: 'transform 0.15s, background 0.15s',
  };

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10, fontSize: 12,
      border: `1.5px solid ${accent}`,
      minWidth: 220, maxWidth: 280, backgroundColor: '#1e1e1e',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: shadow,
      animation: status === 'compiling' ? 'pulse 1.5s ease-in-out infinite' : 'fadeIn 0.2s ease-out',
      cursor: 'pointer',
    }}>
      {/* Multi target handles (left side) */}
      <Handle type="target" position={Position.Left} id="t-top" style={{ ...handleStyle, top: '25%' }} />
      <Handle type="target" position={Position.Left} id="t-mid" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="target" position={Position.Left} id="t-bot" style={{ ...handleStyle, top: '75%' }} />
      {/* Multi source handles (right side) */}
      <Handle type="source" position={Position.Right} id="s-top" style={{ ...handleStyle, top: '25%' }} />
      <Handle type="source" position={Position.Right} id="s-mid" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="s-bot" style={{ ...handleStyle, top: '75%' }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 3, flexShrink: 0,
          background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
          animation: status === 'compiling' ? 'spin 2s linear infinite' : 'none',
        }} />
        <span style={{ fontWeight: 700, color: '#cccccc', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nodeData.id}
        </span>
      </div>

      {/* Badge row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        <Badge color={accent} text={nodeData.type} />
        {nodeData.flow && nodeData.flow !== 'default' && <Badge color="#007acc" text={nodeData.flow} />}
        {nodeData.extends && <Badge color="#b180d7" text={`↑ ${nodeData.extends.split(':').pop()}`} />}
      </div>

      {/* File path */}
      {filename && (
        <div style={{ fontSize: 11, color: '#89d185', marginBottom: 6, fontFamily: 'monospace', opacity: 0.8 }}>
          📄 {filename}
        </div>
      )}

      {/* Fields summary */}
      {(inputCount > 0 || outputCount > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#999999', marginBottom: 6 }}>
          {inputCount > 0 && <span style={{ background: '#252526', padding: '2px 6px', borderRadius: 4 }}>in {inputCount}</span>}
          {inputCount > 0 && outputCount > 0 && <span style={{ color: '#858585' }}>→</span>}
          {outputCount > 0 && <span style={{ background: '#252526', padding: '2px 6px', borderRadius: 4 }}>out {outputCount}</span>}
        </div>
      )}

      {/* Constraints preview */}
      {constraintCount > 0 && (
        <div style={{
          fontSize: 11, color: '#999999', lineHeight: 1.5, opacity: 0.85,
          padding: '6px 8px', background: '#252526', borderRadius: 6,
          borderLeft: `3px solid #cca700`,
        }}>
          {nodeData.constraints.slice(0, 2).map((c, i) => (
            <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.description}
            </div>
          ))}
          {constraintCount > 2 && <div style={{ color: '#858585', fontSize: 10 }}>+{constraintCount - 2} more</div>}
        </div>
      )}

      {/* Stats footer */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, color: '#858585' }}>
        {deps > 0 && <span>🔗 {deps}</span>}
        {tests > 0 && <span>🧪 {tests}</span>}
      </div>
    </div>
  );
}

function Badge({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
      background: `${color}18`, color: color, border: `1px solid ${color}30`,
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
