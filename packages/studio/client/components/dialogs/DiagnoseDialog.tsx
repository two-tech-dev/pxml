import { useState } from 'react';

export function DiagnoseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [logContent, setLogContent] = useState('');
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function runDiagnose() {
    if (!logContent.trim()) return;
    setLoading(true);
    const res = await fetch('/api/diagnose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logContent }),
    });
    setDiagnoses((await res.json()).diagnoses);
    setLoading(false);
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #1f1f1f' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#e5e5e5' }}>Diagnose Logs</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ color: '#525252', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          >{"\u2715"}</button>
        </div>
        <div style={{ padding: 16 }}>
          <textarea value={logContent} onChange={e => setLogContent(e.target.value)} placeholder="Paste JSON log lines here..."
            rows={6} style={{ width: '100%', padding: 8, fontSize: 12, resize: 'vertical', fontFamily: 'monospace', marginBottom: 12 }} />
          <button onClick={runDiagnose} disabled={loading || !logContent.trim()}
            style={{ padding: '6px 16px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: loading ? '#171717' : '#e5e5e5', color: loading ? '#525252' : '#0a0a0a' }}>
            {loading ? 'Diagnosing...' : 'Run Diagnose'}
          </button>
          {diagnoses.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#e5e5e5' }}>Results ({diagnoses.length})</div>
              {diagnoses.map((d, i) => (
                <div key={i} style={{ padding: 10, marginBottom: 6, background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 6 }}>
                  <span style={{ color: '#eab308', fontSize: 12 }}>Flow: {d.flow}</span>
                  <span style={{ color: '#404040', margin: '0 8px' }}>|</span>
                  <span style={{ color: '#a3a3a3', fontSize: 12 }}>Type: {d.suspectedType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
