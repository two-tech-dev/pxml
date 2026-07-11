import { useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useUIStore, useProjectStore } from '../../stores/index.js';
import { Toolbar } from './Toolbar.js';
import { NodeTypePalette } from './NodeTypePalette.js';
import { GraphCanvas } from '../graph/GraphCanvas.js';
import { PropertyPanel } from '../panels/PropertyPanel.js';
import { OutputPanel } from '../panels/OutputPanel.js';
import { Icons } from '../icons.js';

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

  return (
    <ReactFlowProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
        <Toolbar />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Activity Bar */}
          <div style={{
            width: 48, background: '#0a0a0a', display: 'flex', flexDirection: 'column',
            alignItems: 'center', paddingTop: 8, gap: 2, flexShrink: 0,
            borderRight: '1px solid #171717',
          }}>
            <ActBtn active={sidebarOpen} onClick={toggleSidebar} Icon={Icons.panelLeft} label="Explorer" />
            <ActBtn active={rightPanelOpen} onClick={toggleRightPanel} Icon={Icons.panelRight} label="Properties" />
            <div style={{ flex: 1 }} />
          </div>

          {/* Left Panel */}
          {sidebarOpen && (
            <div style={{
              width: leftPanelWidth, flexShrink: 0, background: '#111111',
              borderRight: '1px solid #1f1f1f', position: 'relative',
            }}>
              <NodeTypePalette />
              <div onMouseDown={onLeftResize}
                style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 20 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              />
            </div>
          )}

          {/* Canvas */}
          <div style={{ flex: 1, position: 'relative', background: '#0a0a0a' }}>
            <GraphCanvas />
          </div>

          {/* Right Panel */}
          {rightPanelOpen && (
            <div style={{
              width: rightPanelWidth, flexShrink: 0, background: '#111111',
              borderLeft: '1px solid #1f1f1f', position: 'relative',
            }}>
              <div onMouseDown={onRightResize}
                style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 20 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              />
              <PropertyPanel />
            </div>
          )}
        </div>

        {/* Bottom Panel */}
        <div style={{ borderTop: '1px solid #1f1f1f', flexShrink: 0 }}>
          <div onClick={toggleBottom} style={{
            display: 'flex', alignItems: 'center', padding: '0 14px', height: 32, cursor: 'pointer',
            background: '#111111', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
            color: '#737373', textTransform: 'uppercase', userSelect: 'none',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#171717')}
            onMouseLeave={e => (e.currentTarget.style.background = '#111111')}
          >
            <Icons.chevronDown size={10} style={{ marginRight: 6, transition: 'transform 0.2s', transform: bottomOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
            OUTPUT
            <StatusBadge />
          </div>
          {bottomOpen && (
            <>
              <div onMouseDown={onBottomResize}
                style={{ height: 3, cursor: 'ns-resize', background: '#404040', opacity: 0, transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
              />
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

function ActBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: any; label: string }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: 48, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: active ? '#e5e5e5' : '#525252', position: 'relative',
      transition: 'color 0.15s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#a3a3a3'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#525252'; }}
    >
      <span style={{
        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
        width: 2, height: 20, background: '#e5e5e5', borderRadius: '0 2px 2px 0',
        opacity: active ? 1 : 0, transition: 'opacity 0.15s',
      }} />
      <Icon size={20} strokeWidth={1.5} />
    </button>
  );
}

function StatusBadge() {
  const nodeCount = useProjectStore(s => s.nodes.length);
  if (nodeCount === 0) return null;
  return (
    <span style={{
      marginLeft: 8, fontSize: 10, background: '#171717', padding: '2px 8px',
      borderRadius: 10, color: '#737373', border: '1px solid #262626',
    }}>
      {nodeCount}
    </span>
  );
}

function StatusBar() {
  const project = useProjectStore(s => s.project);
  const isDirty = useProjectStore(s => s.isDirty);
  const selectedNodeId = useProjectStore(s => s.selectedNodeId);
  const nodeCount = useProjectStore(s => s.nodes.length);
  const edgeCount = useProjectStore(s => s.edges.length);

  return (
    <div style={{
      height: 22, background: '#171717', color: '#a3a3a3', display: 'flex',
      alignItems: 'center', padding: '0 12px', fontSize: 11, gap: 14, flexShrink: 0,
      borderTop: '1px solid #1f1f1f',
    }}>
      <span style={{ fontWeight: 600, letterSpacing: '0.3px', color: '#e5e5e5' }}>pxml Studio</span>
      {project && <span>{project.name}{isDirty ? ' \u25cf' : ''}</span>}
      <span style={{ marginLeft: 'auto', fontSize: 10 }}>
        {nodeCount} nodes · {edgeCount} edges
      </span>
      {selectedNodeId && <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selectedNodeId}</span>}
    </div>
  );
}
