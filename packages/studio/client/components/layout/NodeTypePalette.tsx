import type { NodeType } from '../../types/index.js';
import { NODE_COLORS } from '../../types/index.js';
import { useProjectStore } from '../../stores/index.js';
import { X } from 'lucide-react';

const NODE_TYPES: NodeType[] = ['api-route', 'ui-component', 'db-model', 'middleware', 'config-file', 'setup-command'];

export function NodeTypePalette() {
  const addNode = useProjectStore(s => s.addNode);
  const imports = useProjectStore(s => s.imports);
  const packageNodes = useProjectStore(s => s.packageNodes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '0 14px', height: 32, display: 'flex', alignItems: 'center',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: '#737373',
        textTransform: 'uppercase',
      }}>
        Explorer
      </div>

      <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        Node Types
      </div>
      <div style={{ padding: '0 0 8px' }}>
        {NODE_TYPES.map(type => {
          const c = NODE_COLORS[type];
          return (
            <div key={type} draggable onDragStart={e => { e.dataTransfer.setData('application/node-type', type); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'grab', fontSize: 12, color: '#e5e5e5' }}
              onMouseEnter={e => e.currentTarget.style.background = '#171717'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 8, height: 8, borderRadius: 3, flexShrink: 0, background: c.border }} />
              <span style={{ flex: 1 }}>{c.label}</span>
            </div>
          );
        })}
      </div>

      {packageNodes.length > 0 && (
        <div style={{ borderTop: '1px solid #1f1f1f' }}>
          <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Packages ({packageNodes.length})
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 180, padding: '0 0 8px' }}>
            {packageNodes.slice(0, 50).map((pn, i) => {
              const shortId = pn.id.split(':').pop() || pn.id;
              return (
                <div key={i} style={{ padding: '4px 14px 4px 28px', fontSize: 11, color: '#737373', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#171717'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#404040', fontSize: 10 }}>{pn.id.split(':')[0]}:</span>{shortId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid #1f1f1f', marginTop: 'auto' }}>
        <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Imports ({imports.length})
        </div>
        <div style={{ padding: '0 0 8px' }}>
          {imports.map((imp, i) => (
            <div key={i} style={{ padding: '4px 14px 4px 28px', fontSize: 11, color: '#737373', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}
              onMouseEnter={e => e.currentTarget.style.background = '#171717'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: '#a3a3a3', fontSize: 10 }}>{imp.as}</span>
              <span style={{ color: '#404040' }}>{"\u2192"}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>
                {imp.src || imp.from || imp.package}
              </span>
              <button onClick={() => useProjectStore.getState().removeImport(imp.as)} style={{ color: '#404040', padding: '0 2px', display: 'flex' }}><X size={10} /></button>
            </div>
          ))}
          <button onClick={() => {
            const as = prompt('Alias (as=):'); if (!as) return;
            const src = prompt('File source (src=) or blank for package:');
            if (src) { useProjectStore.getState().addImport({ src, as }); }
            else { const pkg = prompt('Package:'); const from = prompt('From:'); if (pkg && from) useProjectStore.getState().addImport({ package: pkg, from, as }); }
          }} style={{ padding: '4px 14px', fontSize: 11, color: '#a3a3a3', width: '100%', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e5e5e5'}
            onMouseLeave={e => e.currentTarget.style.color = '#a3a3a3'}
          >+ Add Import</button>
        </div>
      </div>
    </div>
  );
}
