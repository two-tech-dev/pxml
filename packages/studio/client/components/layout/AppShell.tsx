import { useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useUIStore, useProjectStore } from '../../stores/index.js';
import { Toolbar } from './Toolbar.js';
import { NodeTypePalette } from './NodeTypePalette.js';
import { GraphCanvas } from '../graph/GraphCanvas.js';
import { PropertyPanel } from '../panels/PropertyPanel.js';
import { OutputPanel } from '../panels/OutputPanel.js';

export function AppShell() {
  const sidebarOpen = useUIStore(s => s.leftPanelOpen);
  const rightPanelOpen = useUIStore(s => s.rightPanelOpen);
  const bottomOpen = useUIStore(s => s.bottomPanelOpen);
  const bottomHeight = useUIStore(s => s.bottomPanelHeight);
  const leftPanelWidth = useUIStore(s => s.leftPanelWidth);
  const rightPanelWidth = useUIStore(s => s.rightPanelWidth);
  const setBottomHeight = useUIStore(s => s.setBottomPanelHeight);
  const setLeftWidth = useUIStore(s => s.setLeftPanelWidth);
  const setRightWidth = useUIStore(s => s.setRightPanelWidth);
  const toggleSidebar = useUIStore(s => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore(s => s.toggleRightPanel);
  const toggleBottom = useUIStore(s => s.toggleBottomPanel);

  const bottomResize = useRef<{ startY: number; startH: number } | null>(null);
  const leftResize = useRef<{ startX: number; startW: number } | null>(null);
  const rightResize = useRef<{ startX: number; startW: number } | null>(null);

  const onBottomResize = useCallback((e: React.MouseEvent) => {
    bottomResize.current = { startY: e.clientY, startH: bottomHeight };
    const onMove = (ev: MouseEvent) => {
      if (!bottomResize.current) return;
      setBottomHeight(Math.max(100, Math.min(600, bottomResize.current.startH + (bottomResize.current.startY - ev.clientY))));
    };
    const onUp = () => { bottomResize.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [bottomHeight, setBottomHeight]);

  const onLeftResize = useCallback((e: React.MouseEvent) => {
    leftResize.current = { startX: e.clientX, startW: leftPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!leftResize.current) return;
      setLeftWidth(leftResize.current.startW + (ev.clientX - leftResize.current.startX));
    };
    const onUp = () => { leftResize.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [leftPanelWidth, setLeftWidth]);

  const onRightResize = useCallback((e: React.MouseEvent) => {
    rightResize.current = { startX: e.clientX, startW: rightPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!rightResize.current) return;
      setRightWidth(rightResize.current.startW + (rightResize.current.startX - ev.clientX));
    };
    const onUp = () => { rightResize.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [rightPanelWidth, setRightWidth]);

  const div = (s: React.CSSProperties) => s;

  return (
    <ReactFlowProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
        <Toolbar />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={div({ width: 48, background: '#252526', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 2, flexShrink: 0, borderRight: '1px solid #2d2d2d' })}>
            <ActBtn active={sidebarOpen} onClick={toggleSidebar} icon="⊞" label="Explorer" />
            <ActBtn active={rightPanelOpen} onClick={toggleRightPanel} icon="⊟" label="Properties" />
            <div style={{ flex: 1 }} />
          </div>

          {sidebarOpen && (
            <div style={div({ width: leftPanelWidth, flexShrink: 0, background: '#252526', borderRight: '1px solid #3e3e42', position: 'relative' })}>
              <NodeTypePalette />
              <div onMouseDown={onLeftResize} style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 20 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#007acc66')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />
            </div>
          )}

          <div style={{ flex: 1, position: 'relative', background: '#1e1e1e' }}>
            <GraphCanvas />
          </div>

          {rightPanelOpen && (
            <div style={div({ width: rightPanelWidth, flexShrink: 0, background: '#252526', borderLeft: '1px solid #3e3e42', position: 'relative' })}>
              <div onMouseDown={onRightResize} style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 20 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#007acc66')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />
              <PropertyPanel />
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #3e3e42', flexShrink: 0 }}>
          <div onClick={toggleBottom} style={div({
            display: 'flex', alignItems: 'center', padding: '0 14px', height: 30, cursor: 'pointer',
            background: '#252526', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
            color: '#999999', textTransform: 'uppercase', userSelect: 'none',
          })}>
            <span style={{ marginRight: 6, fontSize: 10 }}>{bottomOpen ? '▾' : '▸'}</span>
            OUTPUT
            <StatusBadge />
          </div>
          {bottomOpen && (
            <>
              <div onMouseDown={onBottomResize} style={{ height: 3, cursor: 'ns-resize', background: '#007acc', opacity: 0, transition: 'opacity 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.5')} onMouseLeave={e => (e.currentTarget.style.opacity = '0')} />
              <div style={{ height: bottomHeight, maxHeight: '60vh' }}>
                <OutputPanel />
              </div>
            </>
          )}
        </div>

        <StatusBar />
      </div>
    </ReactFlowProvider>
  );
}

function ActBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: 48, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, color: active ? '#007acc' : '#858585', position: 'relative',
      transition: 'color 0.15s',
    }}>
      <span style={{
        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
        width: 2, height: 20, background: '#007acc', borderRadius: '0 2px 2px 0',
        opacity: active ? 1 : 0, transition: 'opacity 0.15s',
      }} />
      {icon}
    </button>
  );
}

function StatusBadge() {
  const nodeCount = useProjectStore(s => s.nodes.length);
  if (nodeCount === 0) return null;
  return <span style={{ marginLeft: 8, fontSize: 10, background: '#252526', padding: '1px 6px', borderRadius: 10, color: '#999999' }}>{nodeCount}</span>;
}

function StatusBar() {
  const project = useProjectStore(s => s.project);
  const isDirty = useProjectStore(s => s.isDirty);
  const selectedNodeId = useProjectStore(s => s.selectedNodeId);
  const nodeCount = useProjectStore(s => s.nodes.length);
  const edgeCount = useProjectStore(s => s.edges.length);

  return (
    <div style={{
      height: 24, background: '#007acc', color: '#fff', display: 'flex',
      alignItems: 'center', padding: '0 12px', fontSize: 11, gap: 14, flexShrink: 0,
    }}>
      <span style={{ fontWeight: 700, letterSpacing: '0.3px' }}>pxml Studio</span>
      {project && <span style={{ opacity: 0.9 }}>{project.name}{isDirty ? ' ●' : ''}</span>}
      <span style={{ marginLeft: 'auto', opacity: 0.8, fontSize: 10 }}>
        {nodeCount} nodes · {edgeCount} edges
      </span>
      {selectedNodeId && <span style={{ opacity: 0.9, fontFamily: 'monospace', fontSize: 10 }}>{selectedNodeId}</span>}
    </div>
  );
}
