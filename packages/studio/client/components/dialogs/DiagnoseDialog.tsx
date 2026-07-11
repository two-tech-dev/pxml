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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #3e3e42' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Diagnose Logs</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ color: '#999999', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <textarea value={logContent} onChange={e => setLogContent(e.target.value)}
            placeholder="Paste JSON log lines here..."
            rows={6} style={{ width: '100%', padding: 8, fontSize: 12, resize: 'vertical', fontFamily: 'monospace', marginBottom: 12 }} />
          <button onClick={runDiagnose} disabled={loading || !logContent.trim()}
            style={{ padding: '6px 16px', background: '#007acc', color: '#fff', borderRadius: 2, fontSize: 12 }}>
            {loading ? 'Diagnosing...' : 'Run Diagnose'}
          </button>
          {diagnoses.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#cccccc' }}>Results ({diagnoses.length})</div>
              {diagnoses.map((d, i) => (
                <div key={i} style={{ padding: 10, marginBottom: 6, background: '#1e1e1e', border: '1px solid #3e3e42', borderRadius: 4 }}>
                  <span style={{ color: '#cca700', fontSize: 12 }}>Flow: {d.flow}</span>
                  <span style={{ color: '#999999', margin: '0 8px' }}>|</span>
                  <span style={{ color: '#007acc', fontSize: 12 }}>Type: {d.suspectedType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
