import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/index.js';

interface Bug { id: string; flow: string; description: string; }

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(0,0,0,0.5)',
};
const dialogStyle: React.CSSProperties = {
  background: '#252526', border: '1px solid #3e3e42', borderRadius: 6,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
};

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
    await fetch('/api/bugs_history', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath, xml: editXml }),
    });
    setXml(editXml); setEditing(false);
  }

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #3e3e42' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>bugs_history.xml</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setEditing(!editing); if (!editing) setEditXml(xml); }}
            style={{ fontSize: 12, padding: '4px 10px', background: editing ? '#1e1e1e' : '#007acc', color: '#fff', borderRadius: 2 }}>
            {editing ? 'Cancel' : 'Edit Raw XML'}
          </button>
          <button onClick={onClose} style={{ color: '#999999', fontSize: 16, marginLeft: 8 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {editing ? (
            <div>
              <textarea value={editXml} onChange={e => setEditXml(e.target.value)}
                rows={15} style={{ width: '100%', padding: 8, fontSize: 12, resize: 'vertical', fontFamily: 'monospace' }} />
              <button onClick={save}
                style={{ marginTop: 12, padding: '6px 16px', background: '#007acc', color: '#fff', borderRadius: 2, fontSize: 12 }}>
                Save
              </button>
            </div>
          ) : bugs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#999999' }}>No bugs recorded yet. Bugs are added automatically during self-healing or compile.</div>
          ) : (
            <div>
              {bugs.map((bug, i) => (
                <div key={i} style={{
                  padding: 10, marginBottom: 8, background: '#1e1e1e',
                  border: '1px solid #3e3e42', borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#007acc' }}>{bug.id}</span>
                    <span style={{ fontSize: 11, padding: '1px 6px', background: '#1e1e1e', borderRadius: 3, color: '#999999' }}>
                      flow: {bug.flow}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#cccccc' }}>{bug.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
