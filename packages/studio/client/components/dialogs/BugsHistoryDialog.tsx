import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/index.js';
import { X, Plus, Trash2, Save } from 'lucide-react';

interface Bug { id: string; flow: string; description: string; }

function buildBugsXml(bugs: Bug[]): string {
  return `<bugs xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="bugs.xsd">
${bugs.map(b => `  <bug id="${b.id}" flow="${b.flow}">
    ${b.description}
  </bug>`).join('\n')}
</bugs>`;
}

export function BugsHistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspacePath = useProjectStore(s => s.workspacePath);
  const nodes = useProjectStore(s => s.nodes);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Collect available IDs and flows
  const nodeIds = [...new Set(nodes.map(n => n.data.id))];
  const flows = [...new Set(nodes.map(n => n.data.flow).filter(f => f && f !== 'default'))];

  useEffect(() => {
    if (!open || !workspacePath) return;
    fetch(`/api/bugs_history?path=${encodeURIComponent(workspacePath)}`)
      .then(r => r.json()).then(d => { setBugs(d.bugs || []); setDirty(false); }).catch(() => {});
  }, [open, workspacePath]);

  function addBug() {
    setBugs(prev => [...prev, { id: '', flow: '', description: '' }]);
    setDirty(true);
  }

  function removeBug(index: number) {
    setBugs(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  function updateBug(index: number, patch: Partial<Bug>) {
    setBugs(prev => prev.map((b, i) => i === index ? { ...b, ...patch } : b));
    setDirty(true);
  }

  async function save() {
    if (!workspacePath) return;
    setSaving(true);
    const xml = buildBugsXml(bugs);
    await fetch('/api/bugs_history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath, xml }),
    });
    setDirty(false);
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#111111', border: '1px solid #262626', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', width: 780, maxHeight: '85vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease-out', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #1f1f1f', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#e5e5e5', letterSpacing: '-0.2px' }}>Bugs History</div>
            <div style={{ fontSize: 11, color: '#525252', marginTop: 2 }}>bugs_history.xml — AI uses this to prevent regression</div>
          </div>
          <div style={{ flex: 1 }} />
          {bugs.length > 0 && (
            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: '#1c1c1c', color: '#737373', border: '1px solid #262626', fontWeight: 600 }}>
              {bugs.length} bug{bugs.length !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={addBug} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
            padding: '6px 14px', borderRadius: 6, color: '#a3a3a3',
            border: '1px solid #262626', background: 'transparent',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; e.currentTarget.style.color = '#e5e5e5'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a3a3a3'; }}
          ><Plus size={14} /> Add Bug</button>
          <button onClick={save} disabled={!dirty || saving} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            padding: '6px 14px', borderRadius: 6,
            background: dirty ? '#e5e5e5' : '#262626',
            color: dirty ? '#0a0a0a' : '#525252',
            border: '1px solid transparent',
          }}
            onMouseEnter={e => { if (dirty) e.currentTarget.style.background = '#d4d4d4'; }}
            onMouseLeave={e => { if (dirty) e.currentTarget.style.background = '#e5e5e5'; }}
          ><Save size={13} /> {saving ? 'Saving...' : 'Save'}</button>
          <button onClick={onClose} style={{ color: '#525252', padding: '6px 8px', borderRadius: 6 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          ><X size={16} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#0a0a0a' }}>
          {bugs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#525252', fontSize: 13, lineHeight: 1.6 }}>
              No bugs recorded yet.<br />
              <span style={{ fontSize: 11, color: '#404040' }}>Add bugs to help AI avoid repeating the same mistakes.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bugs.map((bug, i) => (
                <div key={i} style={{
                  padding: 16, background: '#111111', border: '1px solid #1f1f1f',
                  borderRadius: 8, position: 'relative',
                }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#525252', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bug ID</div>
                      <select value={bug.id} onChange={e => updateBug(i, { id: e.target.value })} style={{
                        width: '100%', padding: '7px 10px', fontSize: 12, background: '#171717',
                        border: '1px solid #262626', borderRadius: 6, color: '#e5e5e5', cursor: 'pointer',
                        fontFamily: "'JetBrains Mono',monospace", outline: 'none',
                      }}>
                        <option value="">— select node —</option>
                        {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
                        {bug.id && !nodeIds.includes(bug.id) && <option value={bug.id}>{bug.id} (custom)</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#525252', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Flow</div>
                      <select value={bug.flow} onChange={e => updateBug(i, { flow: e.target.value })} style={{
                        width: '100%', padding: '7px 10px', fontSize: 12, background: '#171717',
                        border: '1px solid #262626', borderRadius: 6, color: '#e5e5e5', cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none',
                      }}>
                        <option value="">— select flow —</option>
                        {flows.map(f => <option key={f} value={f}>{f}</option>)}
                        {bug.flow && !flows.includes(bug.flow) && <option value={bug.flow}>{bug.flow} (custom)</option>}
                      </select>
                    </div>
                    <button onClick={() => removeBug(i)} style={{
                      padding: '6px 8px', borderRadius: 6, color: '#525252', marginTop: 18,
                      display: 'flex', alignItems: 'center', flexShrink: 0,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
                      title="Remove this bug"
                    ><Trash2 size={14} /></button>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#525252', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
                    <textarea value={bug.description} onChange={e => updateBug(i, { description: e.target.value })}
                      placeholder="Describe what went wrong and how to prevent it..."
                      rows={3} style={{
                        width: '100%', padding: '8px 10px', fontSize: 12, resize: 'vertical',
                        background: '#171717', border: '1px solid #262626', borderRadius: 6,
                        color: '#e5e5e5', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit',
                      }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
