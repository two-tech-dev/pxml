import { useOutputStore, type OutputChannel } from '../../stores/index.js';
import { XCircle, CheckCircle, AlertTriangle, Circle, Trash2 } from 'lucide-react';
import { useAppSettings } from '../../hooks/useAppSettings.js';

const CHANNELS: { key: OutputChannel; label: string; shortcut: string }[] = [
  { key: 'compile', label: 'Compile', shortcut: '1' },
  { key: 'test', label: 'Tests', shortcut: '2' },
  { key: 'fix', label: 'Fixes', shortcut: '3' },
  { key: 'plugin', label: 'Plugins', shortcut: '4' },
  { key: 'general', label: 'General', shortcut: '5' },
];

export function OutputPanel() {
  const lines = useOutputStore(s => s.lines);
  const activeChannel = useOutputStore(s => s.activeChannel);
  const clearChannel = useOutputStore(s => s.clearChannel);
  const setActiveChannel = useOutputStore(s => s.setActiveChannel);
  const settings = useAppSettings();

  const filteredLines = lines.filter(l => (l.channel || 'general') === activeChannel);
  const displayLines = settings.outputMaxLines > 0
    ? filteredLines.slice(-settings.outputMaxLines)
    : filteredLines;

  const channelCounts = CHANNELS.map(ch => ({
    ...ch,
    count: lines.filter(l => (l.channel || 'general') === ch.key).length,
    hasError: lines.some(l => (l.channel || 'general') === ch.key && l.type === 'error'),
  }));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a',
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
    }}>
      {/* Channel tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 28,
        borderBottom: '1px solid #1f1f1f', flexShrink: 0, overflowX: 'auto',
      }}>
        {channelCounts.map(ch => (
          <button key={ch.key} onClick={() => setActiveChannel(ch.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: '100%',
            fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
            color: activeChannel === ch.key ? '#e5e5e5' : '#737373',
            borderBottom: activeChannel === ch.key ? '2px solid #e5e5e5' : '2px solid transparent',
            background: activeChannel === ch.key ? '#171717' : 'transparent',
            transition: 'all 0.1s',
          }}
            onMouseEnter={e => { if (activeChannel !== ch.key) e.currentTarget.style.color = '#a3a3a3'; }}
            onMouseLeave={e => { if (activeChannel !== ch.key) e.currentTarget.style.color = '#737373'; }}
          >
            {ch.label}
            {ch.count > 0 && (
              <span style={{
                fontSize: 10, background: ch.hasError ? 'rgba(239,68,68,0.2)' : '#262626',
                padding: '0 5px', borderRadius: 8, color: ch.hasError ? '#ef4444' : '#525252',
                border: '1px solid transparent',
              }}>{ch.count}</span>
            )}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 4 }} />
        <button onClick={() => clearChannel(activeChannel)} style={{
          padding: '2px 8px', fontSize: 11, color: '#525252', marginRight: 4, borderRadius: 4,
          display: 'flex', alignItems: 'center', gap: 3,
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#a3a3a3'; e.currentTarget.style.background = '#171717'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
        ><Trash2 size={11} /></button>
      </div>

      {/* Output content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {displayLines.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#525252', lineHeight: 1.6 }}>
            {activeChannel === 'compile' && 'Compile output appears here'}
            {activeChannel === 'test' && 'Test output appears here'}
            {activeChannel === 'fix' && 'Fix/self-heal output appears here'}
            {activeChannel === 'plugin' && 'Plugin operations appear here'}
            {activeChannel === 'general' && 'General output appears here'}
          </div>
        )}
        {displayLines.map((line, i) => {
          const color = line.type === 'error' ? '#ef4444' : line.type === 'success' ? '#22c55e' : line.type === 'warn' ? '#eab308' : '#737373';
          const Icon = line.type === 'error' ? XCircle : line.type === 'success' ? CheckCircle : line.type === 'warn' ? AlertTriangle : Circle;
          return (
            <div key={i} style={{
              padding: '3px 14px', fontSize: 12, color, display: 'flex', alignItems: 'baseline', gap: 8,
              background: line.type === 'error' ? 'rgba(239,68,68,0.06)' : line.type === 'warn' ? 'rgba(234,179,8,0.06)' : 'transparent',
              borderLeft: line.type === 'error' ? '3px solid #ef4444' : line.type === 'warn' ? '3px solid #eab308' : '3px solid transparent',
            }}>
              {settings.timestampsVisible && (
                <span style={{ color: '#404040', fontSize: 10, minWidth: 70 }}>{new Date(line.timestamp).toLocaleTimeString()}</span>
              )}
              <Icon size={11} strokeWidth={2} style={{ color: color, flexShrink: 0 }} />
              {line.nodeId && <span style={{ color: '#a3a3a3', fontSize: 11 }}>{line.nodeId}</span>}
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{line.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
