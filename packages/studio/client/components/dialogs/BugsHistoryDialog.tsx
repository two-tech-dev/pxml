import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/index.js';

interface Bug { id: string; flow: string; description: string; }

export function BugsHistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspacePath = useProjectStore(s => s.workspacePath);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [xml, setXml] = useState('');
  const [editing, setEditing] = useState(false);
  const [editXml, setEditXml] = useState('');

  useEffect(() => {
    if (!open || !workspacePath) return;
    fetch(`/api/bugs_history?path=${encodeURIComponent(workspacePath)}`)
      .then(r => r.json()).then(d => { setBugs(d.bugs); setXml(d.xml); }).catch(() => {});
  }, [open, workspacePath]);

  async function save() {
    await fetch('/api/bugs_history', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: workspacePath, xml: editXml }) });
    setXml(editXml); setEditing(false);
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #1f1f1f' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#e5e5e5' }}>bugs_history.xml</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setEditing(!editing); if (!editing) setEditXml(xml); }}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, fontWeight: 500, background: editing ? '#171717' : '#e5e5e5', color: editing ? '#a3a3a3' : '#0a0a0a', border: editing ? '1px solid #262626' : 'none' }}>
            {editing ? 'Cancel' : 'Edit Raw XML'}
          </button>
          <button onClick={onClose} style={{ color: '#525252', fontSize: 16, marginLeft: 8, padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          >{"\u2715"}</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {editing ? (
            <div>
              <textarea value={editXml} onChange={e => setEditXml(e.target.value)} rows={15} style={{ width: '100%', padding: 8, fontSize: 12, resize: 'vertical', fontFamily: 'monospace' }} />
              <button onClick={save} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#e5e5e5', color: '#0a0a0a' }}>Save</button>
            </div>
          ) : bugs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#525252' }}>No bugs recorded yet.</div>
          ) : (
            <div>
              {bugs.map((bug, i) => (
                <div key={i} style={{ padding: 12, marginBottom: 8, background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#a3a3a3' }}>{bug.id}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', background: '#171717', borderRadius: 4, color: '#525252', border: '1px solid #262626' }}>
                      flow: {bug.flow}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#e5e5e5' }}>{bug.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
