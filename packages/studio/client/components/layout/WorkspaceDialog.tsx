import { useState } from 'react';
import { useProjectStore, useUIStore } from '../../stores/index.js';

export function WorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const openProject = useProjectStore(s => s.openProject);
  const workspacePath = useProjectStore(s => s.workspacePath);
  const project = useProjectStore(s => s.project);

  async function handleOpen() {
    if (!path.trim()) return;
    try { await openProject(path.trim()); setOpen(false); } catch (e: any) { alert(e.message); }
  }

  return (
    <>
      <div style={{ height: 40, background: '#111111', borderBottom: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setOpen(true)}
          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 4, fontWeight: 500, background: '#e5e5e5', color: '#0a0a0a' }}>Open Project</button>
        <button onClick={() => useProjectStore.getState().saveProject()}
          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 4, fontWeight: 500, background: '#171717', color: '#a3a3a3', border: '1px solid #262626' }} disabled={!workspacePath}>Save</button>
        {project && <span style={{ fontSize: 12, color: '#737373', marginLeft: 4 }}>{project.name} <span style={{ color: '#404040' }}>({project.stack})</span></span>}
        <button onClick={() => useProjectStore.getState().relayout()}
          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 4, fontWeight: 500, background: '#171717', color: '#a3a3a3', border: '1px solid #262626', marginLeft: 'auto' }}>Auto Layout</button>
      </div>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, padding: 24, width: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease-out' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#e5e5e5' }}>Open pxml Project</h2>
            <input type="text" value={path} onChange={e => setPath(e.target.value)}
              placeholder="/path/to/your/project (contains project.xml)"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, marginBottom: 16, background: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, color: '#e5e5e5', fontFamily: 'monospace' }}
              onKeyDown={e => e.key === 'Enter' && handleOpen()} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setOpen(false)} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 4, background: '#171717', color: '#a3a3a3', border: '1px solid #262626' }}>Cancel</button>
              <button onClick={handleOpen} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 4, fontWeight: 600, background: '#e5e5e5', color: '#0a0a0a' }}>Open</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
