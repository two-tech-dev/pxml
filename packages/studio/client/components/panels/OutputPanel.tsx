import { useOutputStore } from '../../stores/index.js';
import { XCircle, CheckCircle, AlertTriangle, Circle } from 'lucide-react';

export function OutputPanel() {
  const lines = useOutputStore(s => s.lines);
  const clear = useOutputStore(s => s.clear);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a',
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 14px', height: 28,
        borderBottom: '1px solid #1f1f1f', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Output</span>
        <span style={{ fontSize: 10, background: '#171717', padding: '1px 6px', borderRadius: 8, color: '#525252', border: '1px solid #262626' }}>{lines.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={clear} style={{ fontSize: 11, color: '#525252', padding: '2px 8px', borderRadius: 4 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#a3a3a3'; e.currentTarget.style.background = '#171717'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
        >Clear</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {lines.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#525252', lineHeight: 1.6 }}>
            Output appears here<br />when you compile, test, or fix nodes.
          </div>
        )}
        {lines.map((line, i) => {
          const color = line.type === 'error' ? '#ef4444' : line.type === 'success' ? '#22c55e' : line.type === 'warn' ? '#eab308' : '#737373';
          const Icon = line.type === 'error' ? XCircle : line.type === 'success' ? CheckCircle : line.type === 'warn' ? AlertTriangle : Circle;
          return (
            <div key={i} style={{
              padding: '3px 14px', fontSize: 12, color, display: 'flex', alignItems: 'baseline', gap: 8,
              background: line.type === 'error' ? 'rgba(239,68,68,0.06)' : line.type === 'warn' ? 'rgba(234,179,8,0.06)' : 'transparent',
              borderLeft: line.type === 'error' ? '3px solid #ef4444' : line.type === 'warn' ? '3px solid #eab308' : '3px solid transparent',
            }}>
              <span style={{ color: '#404040', fontSize: 10, minWidth: 70 }}>{new Date(line.timestamp).toLocaleTimeString()}</span>
              <Icon size={11} strokeWidth={2} style={{ color: color, flexShrink: 0 }} />
              {line.nodeId && <span style={{ color: '#a3a3a3', fontSize: 11 }}>{line.nodeId}</span>}
              <span style={{ flex: 1 }}>{line.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
