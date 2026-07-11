import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { type EdgeProps } from '@xyflow/react';
import { useProjectStore } from '../../../stores/index.js';

function DrawioEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, selected } = props;
  const [hover, setHover] = useState(false);
  const removeEdge = useProjectStore(s => s.removeConnection);  
  const waypoints = (props.data as any)?.waypoints || [];
  const allPoints = [ { x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY } ];
  const active = selected || hover;
  const color = selected ? '#007acc' : hover ? '#999999' : '#858585';

  let pathD = `M${allPoints[0].x},${allPoints[0].y}`;
  for (let i = 1; i < allPoints.length; i++) pathD += ` L${allPoints[i].x},${allPoints[i].y}`;

  // Arrow
  const last = allPoints[allPoints.length - 1], prev = allPoints[allPoints.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const s = 7;
  const ax = last.x - s * Math.cos(angle - 0.6), ay = last.y - s * Math.sin(angle - 0.6);
  const bx = last.x - s * Math.cos(angle + 0.6), by = last.y - s * Math.sin(angle + 0.6);

  const updateWp = useCallback((newWp: typeof waypoints) => {
    const store = useProjectStore.getState();
    const idx = store.edges.findIndex(e => e.id === id);
    if (idx >= 0) {
      const nedges = [...store.edges];
      nedges[idx] = { ...nedges[idx], data: { ...nedges[idx].data, waypoints: newWp } };
      useProjectStore.setState({ edges: nedges, isDirty: true });
    }
  }, [id]);

  const midX = (sourceX + targetX) / 2, midY = (sourceY + targetY) / 2;

  return (
    <>
      <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <path d={pathD} fill="none" stroke="transparent" strokeWidth={20} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={active ? 3 : 2} style={{ transition: 'all 0.2s' }} />
        <polygon points={`${last.x},${last.y} ${ax},${ay} ${bx},${by}`} fill={color} style={{ transition: 'fill 0.2s' }} />
      </g>
      {active && <EdgeToolsPortal id={id} waypoints={waypoints} allPoints={allPoints} midX={midX} midY={midY} color={color} updateWp={updateWp} removeEdge={removeEdge} />}
    </>
  );
}

// Portal-based tools completely outside ReactFlow's SVG event system
function EdgeToolsPortal({ id, waypoints, allPoints, midX, midY, color, updateWp, removeEdge }: {
  id: string; waypoints: {x:number;y:number}[]; allPoints: {x:number;y:number}[];
  midX: number; midY: number; color: string;
  updateWp: (w: typeof waypoints) => void; removeEdge: (id: string) => void;
}) {
  const [activeWp, setActiveWp] = useState<number | null>(null);
  const [, forceUpdate] = useState(0);
  const elRef = useRef(document.createElement('div'));

  useEffect(() => {
    const el = elRef.current;
    el.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:50';
    document.body.appendChild(el);

    // Re-render on viewport change (pan/zoom)
    const vp = document.querySelector('.react-flow__viewport');
    if (!vp) return () => document.body.removeChild(el);
    const observer = new MutationObserver(() => forceUpdate(n => n + 1));
    observer.observe(vp, { attributes: true, attributeFilter: ['style'] });
    return () => { observer.disconnect(); document.body.removeChild(el); };
  }, []);

  // Convert flow coords to screen coords using .react-flow__viewport transform
  function getScreenPos(x: number, y: number) {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!vp) return { x, y };
    const style = vp.style.transform || '';
    const match = style.match(/translate\(([^,]+)px,\s*([^)]+)px\).*scale\(([^)]+)\)/);
    if (!match) return { x, y };
    const tx = parseFloat(match[1]), ty = parseFloat(match[2]), sc = parseFloat(match[3]);
    const rect = vp.parentElement?.getBoundingClientRect();
    const ox = rect?.left || 0, oy = rect?.top || 0;
    return { x: x * sc + tx + ox, y: y * sc + ty + oy };
  }

  const startDrag = useCallback((i: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const orig = waypoints.map(w => ({ ...w }));

    const move = (ev: MouseEvent) => {
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
      const style = vp?.style.transform || '';
      const m = style.match(/translate\(([^,]+)px,\s*([^)]+)px\).*scale\(([^)]+)\)/);
      const sc = m ? parseFloat(m[3]) : 1;
      const dx = (ev.clientX - startX) / sc;
      const dy = (ev.clientY - startY) / sc;
      const u = orig.map((w, j) => j === i ? { x: w.x + dx, y: w.y + dy } : { ...w });
      updateWp(u);
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, [waypoints, updateWp]);

  const addWp = useCallback((wpIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const nw = [...waypoints];
    nw.splice(wpIdx, 0, { x: allPoints[wpIdx].x, y: allPoints[wpIdx].y });
    updateWp(nw);
  }, [waypoints, allPoints, updateWp]);

  const delWp = useCallback((i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    updateWp(waypoints.filter((_, j) => j !== i));
  }, [waypoints, updateWp]);

  return createPortal(
    <div>
      {/* Waypoint handles */}
      {waypoints.map((wp, i) => {
        const sp = getScreenPos(wp.x, wp.y);
        const isH = activeWp === i;
        return (
          <div key={`wp-${i}`} style={{
            position: 'absolute', left: sp.x, top: sp.y,
            transform: 'translate(-50%,-50%)', pointerEvents: 'all',
            width: isH ? 36 : 28, height: isH ? 36 : 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'move', zIndex: 60,
          }}
            onMouseEnter={() => setActiveWp(i)}
            onMouseLeave={() => setActiveWp(null)}
            onMouseDown={e => startDrag(i, e)}
            onDoubleClick={e => delWp(i, e)}
          >
            <div style={{
              width: isH ? 14 : 10, height: isH ? 14 : 10, borderRadius: '50%',
              background: isH ? color : '#1e1e1e', border: `2px solid ${color}`,
              boxShadow: isH ? `0 0 10px ${color}` : '0 2px 6px rgba(0,0,0,0.5)',
              transition: 'all 0.15s', pointerEvents: 'none',
            }} />
          </div>
        );
      })}

      {/* Midpoint add buttons */}
      {waypoints.length === 0 ? (
        (() => {
          const sp = getScreenPos(midX, midY);
          return (
            <div style={{
              position: 'absolute', left: sp.x, top: sp.y, transform: 'translate(-50%,-50%)',
              pointerEvents: 'all', cursor: 'copy', zIndex: 55,
            }} onClick={e => { e.stopPropagation(); updateWp([{ x: midX + 60, y: midY + 40 }]); }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#1e1e1e',
                border: `2px solid ${color}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, fontWeight: 'bold', color,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}>+</div>
            </div>
          );
        })()
      ) : (
        allPoints.slice(0, -1).map((p, i) => {
          const next = allPoints[i + 1];
          const mx = (p.x + next.x) / 2, my = (p.y + next.y) / 2;
          const sp = getScreenPos(mx, my);
          return (
            <div key={`mid-${i}`} style={{
              position: 'absolute', left: sp.x, top: sp.y, transform: 'translate(-50%,-50%)',
              pointerEvents: 'all', cursor: 'copy', zIndex: 52,
            }} onClick={e => addWp(i, e)}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: '#1e1e1e',
                border: `1.5px solid ${color}`, opacity: 0.6, transition: 'opacity 0.15s',
              }} />
            </div>
          );
        })
      )}

      {/* Delete button */}
      {(() => {
        const sp = getScreenPos(midX, midY - 30);
        return (
          <div style={{
            position: 'absolute', left: sp.x, top: sp.y, transform: 'translate(-50%,-50%)',
            pointerEvents: 'all', zIndex: 65,
          }}>
            <button onClick={e => { e.stopPropagation(); removeEdge(id); }}
              style={{
                width: 26, height: 26, borderRadius: '50%', background: '#f44747',
                color: '#fff', fontSize: 13, border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
          </div>
        );
      })()}
    </div>,
    elRef.current
  );
}

function ExtendsEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const dx = targetX - sourceX;
  const cx1 = sourceX + Math.abs(dx) * 0.4, cx2 = targetX - Math.abs(dx) * 0.4;
  const d = `M${sourceX},${sourceY} C${cx1},${sourceY} ${cx2},${targetY} ${targetX},${targetY}`;
  const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
  return (
    <g>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={d} fill="none" stroke="#b180d7" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6} />
      <polygon points={`${targetX-6*Math.cos(angle-0.7)},${targetY-6*Math.sin(angle-0.7)} ${targetX},${targetY} ${targetX-6*Math.cos(angle+0.7)},${targetY-6*Math.sin(angle+0.7)}`} fill="#b180d7" opacity={0.6} />
    </g>
  );
}

export { DrawioEdge, ExtendsEdge };
