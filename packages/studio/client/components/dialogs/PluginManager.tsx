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
    fetch(`/api/plugin/list?path=${encodeURIComponent(workspacePath)}`)
      .then(r => r.json()).then(d => setPackages(d.packages || [])).catch(() => {});
  }, [open, workspacePath]);

  async function addPlugin() {
    if (!gitUrl.trim() || !workspacePath) return;
    setLoading(true);
    const res = await fetch('/api/plugin/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath, url: gitUrl, name: name || undefined }),
    });
    if (!res.ok) { alert(await res.text()); setLoading(false); return; }
    const data = await res.json();
    setPackages(prev => [...prev.filter(p => p.name !== data.name), { name: data.name, url: gitUrl, installed: true }]);
    setGitUrl(''); setName(''); setLoading(false);
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 550, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #3e3e42' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Plugin Manager</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ color: '#999999', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#cccccc' }}>Install from Git</div>
            <input value={gitUrl} onChange={e => setGitUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, marginBottom: 6, background: '#1e1e1e', border: '1px solid #3e3e42', borderRadius: 4, color: '#cccccc', outline: 'none' }} />
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Package name (optional)"
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, marginBottom: 8, background: '#1e1e1e', border: '1px solid #3e3e42', borderRadius: 4, color: '#cccccc', outline: 'none' }} />
            <button onClick={addPlugin} disabled={loading || !gitUrl.trim()}
              style={{ padding: '6px 16px', background: '#007acc', color: '#fff', borderRadius: 2, fontSize: 12 }}>
              {loading ? 'Installing...' : 'Install'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid #3e3e42', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#cccccc' }}>Installed ({packages.length})</div>
            {packages.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999999' }}>No packages installed. Run <code>pxml install</code> or add from git above.</div>
            ) : (
              packages.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', background: '#1e1e1e', border: '1px solid #3e3e42', borderRadius: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#cccccc' }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: '#999999', marginLeft: 12, fontFamily: 'monospace', flex: 1 }}>{p.url}</span>
                  <span style={{ fontSize: 11, color: '#89d185' }}>✓ installed</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
