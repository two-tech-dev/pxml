import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/index.js';

interface Package { name: string; url: string; installed: boolean; }

export function PluginManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspacePath = useProjectStore(s => s.workspacePath);
  const [packages, setPackages] = useState<Package[]>([]);
  const [gitUrl, setGitUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !workspacePath) return;
    fetch(`/api/plugin/list?path=${encodeURIComponent(workspacePath)}`).then(r => r.json()).then(d => setPackages(d.packages || [])).catch(() => {});
  }, [open, workspacePath]);

  async function addPlugin() {
    if (!gitUrl.trim() || !workspacePath) return;
    setLoading(true);
    const res = await fetch('/api/plugin/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: workspacePath, url: gitUrl, name: name || undefined }) });
    if (!res.ok) { alert(await res.text()); setLoading(false); return; }
    const data = await res.json();
    setPackages(prev => [...prev.filter(p => p.name !== data.name), { name: data.name, url: gitUrl, installed: true }]);
    setGitUrl(''); setName(''); setLoading(false);
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: 550, maxHeight: '80vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #1f1f1f' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#e5e5e5' }}>Plugin Manager</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ color: '#525252', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          >{"\u2715"}</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#e5e5e5' }}>Install from Git</div>
            <input value={gitUrl} onChange={e => setGitUrl(e.target.value)} placeholder="https://github.com/user/repo.git"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginBottom: 6 }} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Package name (optional)"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginBottom: 8 }} />
            <button onClick={addPlugin} disabled={loading || !gitUrl.trim()}
              style={{ padding: '6px 16px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: loading ? '#171717' : '#e5e5e5', color: loading ? '#525252' : '#0a0a0a' }}>
              {loading ? 'Installing...' : 'Install'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#e5e5e5' }}>Installed ({packages.length})</div>
            {packages.length === 0 ? (
              <div style={{ fontSize: 12, color: '#525252' }}>No packages installed.</div>
            ) : packages.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e5e5e5' }}>{p.name}</span>
                <span style={{ fontSize: 11, color: '#525252', marginLeft: 12, fontFamily: 'monospace', flex: 1 }}>{p.url}</span>
                <span style={{ fontSize: 11, color: '#22c55e' }}>{"\u2713"} installed</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
