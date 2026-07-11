import { useMemo } from 'react';
import { useProjectStore } from '../../stores/index.js';
import { graphToXml } from '../../utils/xml-serializer.js';

export function XmlPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nodes = useProjectStore(s => s.nodes);
  const imports = useProjectStore(s => s.imports);
  const project = useProjectStore(s => s.project);

  const xml = useMemo(() => {
    if (!project) return '';
    return graphToXml(project, nodes.map(n => n.data), imports);
  }, [project, nodes, imports]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: '#252526', border: '1px solid #3e3e42', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 750, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #3e3e42' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>XML Preview</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => navigator.clipboard.writeText(xml)}
            style={{ padding: '4px 10px', background: '#1e1e1e', borderRadius: 2, fontSize: 11, marginRight: 8 }}>Copy</button>
          <button onClick={onClose} style={{ color: '#999999', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <pre style={{
            margin: 0, fontSize: 12, fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
            color: '#89d185', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {xml}
          </pre>
        </div>
      </div>
    </div>
  );
}
