import { useState, useRef, useEffect } from 'react';
import { useOutputStore, useProjectStore, type OutputChannel } from '../../stores/index.js';
import { XCircle, CheckCircle, AlertTriangle, Circle, Trash2, TerminalIcon, ChevronRight } from 'lucide-react';
import { useAppSettings } from '../../hooks/useAppSettings.js';

const CHANNELS: { key: OutputChannel | 'console'; label: string; shortcut: string }[] = [
  { key: 'compile', label: 'Compile', shortcut: '1' },
  { key: 'test', label: 'Tests', shortcut: '2' },
  { key: 'fix', label: 'Fixes', shortcut: '3' },
  { key: 'plugin', label: 'Console', shortcut: '4' },
  { key: 'general', label: 'General', shortcut: '5' },
];

export function OutputPanel() {
  const lines = useOutputStore(s => s.lines);
  const activeChannel = useOutputStore(s => s.activeChannel);
  const clearChannel = useOutputStore(s => s.clearChannel);
  const setActiveChannel = useOutputStore(s => s.setActiveChannel);
  const settings = useAppSettings();
  const [tab, setTab] = useState<'output' | 'console'>('output');

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
      {/* Mode tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 28,
        borderBottom: '1px solid #1f1f1f', flexShrink: 0,
      }}>
        <button onClick={() => setTab('output')} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: '100%',
          fontSize: 11, fontWeight: 500,
          color: tab === 'output' ? '#e5e5e5' : '#737373',
          borderBottom: tab === 'output' ? '2px solid #e5e5e5' : '2px solid transparent',
          background: tab === 'output' ? '#171717' : 'transparent',
          transition: 'all 0.1s',
        }}
          onMouseEnter={e => { if (tab !== 'output') e.currentTarget.style.color = '#a3a3a3'; }}
          onMouseLeave={e => { if (tab !== 'output') e.currentTarget.style.color = '#737373'; }}
        >Output</button>
        <button onClick={() => setTab('console')} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: '100%',
          fontSize: 11, fontWeight: 500,
          color: tab === 'console' ? '#e5e5e5' : '#737373',
          borderBottom: tab === 'console' ? '2px solid #e5e5e5' : '2px solid transparent',
          background: tab === 'console' ? '#171717' : 'transparent',
          transition: 'all 0.1s',
        }}
          onMouseEnter={e => { if (tab !== 'console') e.currentTarget.style.color = '#a3a3a3'; }}
          onMouseLeave={e => { if (tab !== 'console') e.currentTarget.style.color = '#737373'; }}
        ><TerminalIcon size={12} /> Console</button>
        <div style={{ flex: 1, minWidth: 4 }} />
        {tab === 'output' && activeChannel !== 'plugin' && (
          <button onClick={() => clearChannel(activeChannel)} style={{
            padding: '2px 8px', fontSize: 11, color: '#525252', marginRight: 4, borderRadius: 4,
            display: 'flex', alignItems: 'center', gap: 3,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#a3a3a3'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          ><Trash2 size={11} /></button>
        )}
      </div>

      {tab === 'output' ? (
        <OutputView channels={channelCounts} activeChannel={activeChannel} setActiveChannel={setActiveChannel}
          clearChannel={clearChannel} settings={settings} lines={lines} />
      ) : (
        <ConsoleView />
      )}
    </div>
  );
}

function OutputView({ channels, activeChannel, setActiveChannel, clearChannel, settings, lines }: any) {
  const filteredLines = lines.filter((l: any) => (l.channel || 'general') === activeChannel);
  const displayLines = settings.outputMaxLines > 0
    ? filteredLines.slice(-settings.outputMaxLines)
    : filteredLines;

  return (
    <>
      {/* Channel tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 26, flexShrink: 0, overflowX: 'auto',
        borderBottom: '1px solid #171717',
      }}>
        {channels.map((ch: any) => (
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
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {displayLines.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#525252', lineHeight: 1.6 }}>
            {activeChannel === 'compile' && 'Compile output appears here'}
            {activeChannel === 'test' && 'Test output appears here'}
            {activeChannel === 'fix' && 'Fix/self-heal output appears here'}
            {activeChannel === 'plugin' && 'Plugin/console output appears here'}
            {activeChannel === 'general' && 'General output appears here'}
          </div>
        )}
        {displayLines.map((line: any, i: number) => {
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
    </>
  );
}

function ConsoleView() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<{ text: string; type: 'cmd' | 'out' | 'err' }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const workspacePath = useProjectStore(s => s.workspacePath);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [consoleLines]);

  async function execute(command: string) {
    if (!command.trim() || running) return;
    const cmd = command.trim();
    setRunning(true);
    setConsoleLines(prev => [...prev, { text: `$ ${cmd}`, type: 'cmd' }]);
    setHistory(prev => [...prev, cmd]);
    setHistoryIdx(-1);
    setInput('');

    try {
      const res = await fetch('/api/console/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: workspacePath || undefined }),
      });
      const data = await res.json();
      if (data.output) setConsoleLines(prev => [...prev, { text: data.output.replace(/\n$/, ''), type: 'out' }]);
      if (data.error) setConsoleLines(prev => [...prev, { text: data.error, type: 'err' }]);
      if (data.exitCode !== 0) {
        setConsoleLines(prev => [...prev, { text: `Exit code: ${data.exitCode}`, type: 'err' }]);
      }
    } catch (e: any) {
      setConsoleLines(prev => [...prev, { text: e.message, type: 'err' }]);
    }
    setRunning(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { execute(input); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx >= 0) {
        const newIdx = historyIdx + 1;
        if (newIdx >= history.length) { setHistoryIdx(-1); setInput(''); }
        else { setHistoryIdx(newIdx); setInput(history[newIdx]); }
      }
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Output area */}
      <div ref={containerRef} style={{
        flex: 1, overflowY: 'auto', padding: '4px 0', background: '#0a0a0a',
        cursor: 'text',
      }} onClick={() => inputRef.current?.focus()}>
        {consoleLines.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#525252' }}>
            Type a shell command below and press Enter.
            <br />Runs in the project directory if a project is open.
          </div>
        )}
        {consoleLines.map((l, i) => (
          <div key={i} style={{
            padding: '1px 14px', fontSize: 12,
            color: l.type === 'err' ? '#ef4444' : l.type === 'cmd' ? '#22c55e' : '#a3a3a3',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>{l.text}</div>
        ))}
        {running && <div style={{ padding: '1px 14px', fontSize: 12, color: '#525252' }}>...</div>}
      </div>

      {/* Command input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
        borderTop: '1px solid #1f1f1f', background: '#111111', flexShrink: 0,
      }}>
        <ChevronRight size={10} style={{ color: '#22c55e', flexShrink: 0 }} />
        {workspacePath && (
          <span style={{ fontSize: 10, color: '#404040', flexShrink: 0 }}>{workspacePath.split('/').pop()}</span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder={running ? 'Running...' : 'Type command...'}
          style={{
            flex: 1, padding: '4px 6px', fontSize: 12, border: 'none', background: 'transparent',
            color: '#e5e5e5', fontFamily: "'JetBrains Mono',monospace", outline: 'none',
          }}
          autoFocus
        />
      </div>
    </div>
  );
}
