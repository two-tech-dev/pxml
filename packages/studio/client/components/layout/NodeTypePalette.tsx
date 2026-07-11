import type { NodeType } from '../../types/index.js';
import { NODE_COLORS } from '../../types/index.js';
import { useProjectStore } from '../../stores/index.js';

const NODE_TYPES: NodeType[] = ['api-route', 'ui-component', 'db-model', 'middleware', 'config-file', 'setup-command'];

export function NodeTypePalette() {
  const addNode = useProjectStore(s => s.addNode);
  const imports = useProjectStore(s => s.imports);
  const packageNodes = useProjectStore(s => s.packageNodes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '0 14px', height: 32, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: '#999999', textTransform: 'uppercase' }}>
        Explorer
      </div>

      {/* Built-in node types */}
      <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#858585', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        Node Types
      </div>
      <div style={{ padding: '0 0 8px' }}>
        {NODE_TYPES.map(type => {
          const c = NODE_COLORS[type];
          return (
            <div key={type} draggable onDragStart={e => { e.dataTransfer.setData('application/node-type', type); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', cursor: 'grab', fontSize: 12, transition: 'background 0.1s', color: '#cccccc' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2d2e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ width: 8, height: 8, borderRadius: 3, flexShrink: 0, background: c.border }} />
              <span style={{ flex: 1 }}>{c.label}</span>
            </div>
          );
        })}
      </div>

      {/* Package nodes */}
      {packageNodes.length > 0 && (
        <div style={{ borderTop: '1px solid #3e3e42' }}>
          <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#858585', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Packages ({packageNodes.length})
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 180, padding: '0 0 8px' }}>
            {packageNodes.slice(0, 50).map((pn, i) => {
              const shortId = pn.id.split(':').pop() || pn.id;
              return (
                <div key={i} style={{ padding: '3px 14px 3px 28px', fontSize: 11, color: '#999999', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2a2d2e'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ color: '#b180d7', fontSize: 10 }}>📦</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#858585', fontSize: 10 }}>{pn.id.split(':')[0]}:</span>{shortId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Imports */}
      <div style={{ borderTop: '1px solid #3e3e42', marginTop: 'auto' }}>
        <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#858585', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Imports ({imports.length})
        </div>
        <div style={{ padding: '0 0 8px' }}>
          {imports.map((imp, i) => (
            <div key={i} style={{ padding: '3px 14px 3px 28px', fontSize: 11, color: '#999999', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
              <span style={{ color: '#007acc', fontSize: 10 }}>{imp.as}</span>
              <span style={{ color: '#858585' }}>→</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>
                {imp.src || imp.from || imp.package}
              </span>
              <button onClick={() => useProjectStore.getState().removeImport(imp.as)}
                style={{ color: '#858585', fontSize: 10, padding: '0 2px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => {
            const as = prompt('Alias (as=):'); if (!as) return;
            const src = prompt('File source (src=) or blank for package:');
            if (src) { useProjectStore.getState().addImport({ src, as }); }
            else { const pkg = prompt('Package:'); const from = prompt('From:'); if (pkg && from) useProjectStore.getState().addImport({ package: pkg, from, as }); }
          }} style={{ padding: '4px 14px', fontSize: 11, color: '#007acc', width: '100%', textAlign: 'left' }}>+ Add Import</button>
        </div>
      </div>
    </div>
  );
}
