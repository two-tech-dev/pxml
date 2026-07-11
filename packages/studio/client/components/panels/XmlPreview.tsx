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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#171717', border: '1px solid #262626', borderRadius: 8,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: 750, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #1f1f1f' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#e5e5e5' }}>XML Preview</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => navigator.clipboard.writeText(xml)}
            style={{ padding: '4px 10px', background: '#171717', borderRadius: 4, fontSize: 11, marginRight: 8, color: '#a3a3a3', border: '1px solid #262626' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#404040'; e.currentTarget.style.color = '#e5e5e5'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.color = '#a3a3a3'; }}
          >Copy</button>
          <button onClick={onClose} style={{ color: '#737373', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.background = 'transparent'; }}
          >{"\u2715"}</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <pre style={{ margin: 0, fontSize: 12, fontFamily: "'Cascadia Code','Fira Code',monospace", color: '#22c55e', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>
            {xml}
          </pre>
        </div>
      </div>
    </div>
  );
}
