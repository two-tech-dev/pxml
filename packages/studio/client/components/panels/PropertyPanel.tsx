import { useProjectStore, useUIStore } from '../../stores/index.js';
import type { NodeData } from '../../types/index.js';
import { useRef, useState } from 'react';

const TAB_KEYS = ['basic', 'fields', 'constraints', 'tests', 'images', 'meta'] as const;
const TAB_LABELS: Record<string, string> = {
  basic: 'Info', fields: 'Fields', constraints: 'Rules', tests: 'Tests', images: 'Images', meta: 'Meta',
};

export function PropertyPanel() {
  const selectedNodeId = useProjectStore(s => s.selectedNodeId);
  const node = useProjectStore(s => s.nodes.find(n => n.id === selectedNodeId));
  const updateNode = useProjectStore(s => s.updateNode);
  const removeNode = useProjectStore(s => s.removeNode);
  const tab = useUIStore(s => s.propertyPanelTab);
  const setTab = useUIStore(s => s.setPropertyPanelTab);

  if (!node) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: '#525252', textAlign: 'center', marginTop: 40 }}>
        Select a node to edit its properties
      </div>
    );
  }

  const d = node.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111111' }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 12px',
        borderBottom: '1px solid #1f1f1f', gap: 6,
      }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: '#e5e5e5' }}>{d.id}</span>
        <span style={{
          fontSize: 10, color: '#737373', padding: '2px 8px', background: '#171717',
          borderRadius: 4, border: '1px solid #262626',
        }}>
          {d.type}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => removeNode(d.id)}
          style={{
            color: '#525252', fontSize: 14, padding: '2px 6px', borderRadius: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          title="Delete node"
        >\u2715</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1f1f1f' }}>
        {TAB_KEYS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '7px 0', fontSize: 11, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#e5e5e5' : '#737373',
              borderBottom: tab === t ? '2px solid #e5e5e5' : '2px solid transparent',
              background: tab === t ? '#171717' : 'transparent',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {tab === 'basic' && <BasicTab data={d} update={updateNode} />}
        {tab === 'fields' && <FieldsTab data={d} update={updateNode} />}
        {tab === 'constraints' && <ConstraintsTab data={d} update={updateNode} />}
        {tab === 'tests' && <TestsTab data={d} update={updateNode} />}
        {tab === 'images' && <ImagesTab data={d} update={updateNode} />}
        {tab === 'meta' && <MetaTab data={d} update={updateNode} />}
      </div>
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: '100%', padding: '5px 8px', marginBottom: 10, fontSize: 12,
  background: '#0a0a0a', border: '1px solid #262626', borderRadius: 4,
  color: '#e5e5e5', outline: 'none',
};
const labelS: React.CSSProperties = {
  fontSize: 11, color: '#737373', marginBottom: 4, fontWeight: 500,
};

function BasicTab({ data: d, update }: { data: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      <div style={labelS}>ID</div>
      <input style={inputS} value={d.id} onChange={e => update(d.id, { id: e.target.value })} />
      <div style={labelS}>Type</div>
      <select style={{ ...inputS, cursor: 'pointer' }} value={d.type} onChange={e => update(d.id, { type: e.target.value as NodeData['type'] })}>
        <option value="api-route">api-route</option>
        <option value="ui-component">ui-component</option>
        <option value="db-model">db-model</option>
        <option value="middleware">middleware</option>
        <option value="config-file">config-file</option>
        <option value="setup-command">setup-command</option>
      </select>
      <div style={labelS}>Flow</div>
      <input style={inputS} value={d.flow} onChange={e => update(d.id, { flow: e.target.value })} />
      <div style={labelS}>Extends</div>
      <input style={inputS} value={d.extends || ''} onChange={e => update(d.id, { extends: e.target.value || undefined })} placeholder="parent node ID" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" checked={d.autogenTests} onChange={e => update(d.id, { autogenTests: e.target.checked })} />
        Autogen Tests
      </label>
    </div>
  );
}

function FieldsTab({ data: d, update }: { data: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      <FieldSection title="Input Fields" items={d.input} onChange={v => update(d.id, { input: v })} />
      <div style={{ height: 16 }} />
      <FieldSection title="Output Fields" items={d.output} onChange={v => update(d.id, { output: v })} />
    </div>
  );
}

function FieldSection({ title, items, onChange }: {
  title: string; items: { name: string; type: string; required: boolean; format?: string }[];
  onChange: (v: typeof items) => void;
}) {
  return (
    <div>
      <div style={{ ...labelS, marginBottom: 6, fontSize: 12, color: '#e5e5e5' }}>{title}</div>
      {items.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
          <input value={f.name} onChange={e => { const c = [...items]; c[i] = { ...c[i], name: e.target.value }; onChange(c); }}
            placeholder="name" style={{ width: 70, padding: '3px 6px', fontSize: 11, background: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, color: '#e5e5e5' }} />
          <input value={f.type} onChange={e => { const c = [...items]; c[i] = { ...c[i], type: e.target.value }; onChange(c); }}
            placeholder="type" style={{ width: 60, padding: '3px 6px', fontSize: 11, background: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, color: '#e5e5e5' }} />
          <label style={{ fontSize: 11, color: '#737373', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={f.required} onChange={e => { const c = [...items]; c[i] = { ...c[i], required: e.target.checked }; onChange(c); }} /> req
          </label>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ color: '#ef4444', fontSize: 12, padding: '0 2px' }}>\u2715</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { name: '', type: 'string', required: true }])} style={{ fontSize: 11, color: '#a3a3a3', padding: '2px 0' }}>+ Add field</button>
    </div>
  );
}

function ConstraintsTab({ data: d, update }: { data: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      {d.constraints.map((c, i) => (
        <div key={i} style={{ marginBottom: 10, padding: 10, background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 6 }}>
          <select value={c.verify} onChange={e => { const copy = [...d.constraints]; copy[i] = { ...copy[i], verify: e.target.value as 'static' | 'llm-judge' }; update(d.id, { constraints: copy }); }}
            style={{ padding: '3px 6px', fontSize: 11, marginBottom: 6, cursor: 'pointer' }}>
            <option value="static">static</option>
            <option value="llm-judge">llm-judge</option>
          </select>
          {c.learnedFrom && <span style={{ fontSize: 10, color: '#eab308', marginLeft: 6 }}>from: {c.learnedFrom}</span>}
          <textarea value={c.description} onChange={e => { const copy = [...d.constraints]; copy[i] = { ...copy[i], description: e.target.value }; update(d.id, { constraints: copy }); }}
            rows={3} style={{ width: '100%', padding: '5px 8px', fontSize: 11, resize: 'vertical', marginTop: 6 }} />
          <button onClick={() => update(d.id, { constraints: d.constraints.filter((_, j) => j !== i) })} style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Remove</button>
        </div>
      ))}
      <button onClick={() => update(d.id, { constraints: [...d.constraints, { verify: 'static', description: '' }] })} style={{ fontSize: 11, color: '#a3a3a3' }}>+ Add rule</button>
    </div>
  );
}

function TestsTab({ data: d, update }: { data: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      {d.tests.map((t, i) => (
        <div key={i} style={{ marginBottom: 10, padding: 10, background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 6 }}>
          <input value={t.name} onChange={e => { const copy = [...d.tests]; copy[i] = { ...copy[i], name: e.target.value }; update(d.id, { tests: copy }); }}
            placeholder="Test name" style={{ width: '100%', padding: '4px 8px', fontSize: 11, marginBottom: 8 }} />
          <div style={{ ...labelS, fontSize: 10 }}>Given (JSON)</div>
          <textarea value={typeof t.given === 'string' ? t.given : JSON.stringify(t.given, null, 2)}
            onChange={e => { const copy = [...d.tests]; try { copy[i] = { ...copy[i], given: JSON.parse(e.target.value) }; } catch {} update(d.id, { tests: copy }); }}
            rows={3} style={{ width: '100%', padding: '5px 8px', fontSize: 11, resize: 'vertical', marginBottom: 8, fontFamily: 'monospace' }} />
          <div style={{ ...labelS, fontSize: 10 }}>Expect (JSON)</div>
          <textarea value={typeof t.expect === 'string' ? t.expect : JSON.stringify(t.expect, null, 2)}
            onChange={e => { const copy = [...d.tests]; try { copy[i] = { ...copy[i], expect: JSON.parse(e.target.value) }; } catch {} update(d.id, { tests: copy }); }}
            rows={2} style={{ width: '100%', padding: '5px 8px', fontSize: 11, resize: 'vertical', fontFamily: 'monospace' }} />
          <button onClick={() => update(d.id, { tests: d.tests.filter((_, j) => j !== i) })} style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Remove</button>
        </div>
      ))}
      <button onClick={() => update(d.id, { tests: [...d.tests, { name: '', given: {}, expect: {} }] })} style={{ fontSize: 11, color: '#a3a3a3' }}>+ Add test</button>
    </div>
  );
}

function ImagesTab({ data: d, update }: { data: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addImages = (files: FileList) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => { update(d.id, { images: [...d.images, reader.result as string] }); };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addImages(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#e5e5e5' : '#262626'}`,
          borderRadius: 6, padding: 20, textAlign: 'center',
          background: dragOver ? '#171717' : '#0a0a0a',
          cursor: 'pointer', marginBottom: 12, transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 11, color: '#525252' }}>Drop images here or click to upload</span>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => e.target.files && addImages(e.target.files)} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {d.images.map((dataUrl, i) => (
          <div key={i} style={{ position: 'relative', width: 64, height: 64, border: '1px solid #262626', borderRadius: 4, overflow: 'hidden' }}>
            <img src={dataUrl} alt={`img-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={e => { e.stopPropagation(); update(d.id, { images: d.images.filter((_, j) => j !== i) }); }}
              style={{
                position: 'absolute', top: 0, right: 0, background: '#ef4444', color: '#fff',
                borderRadius: '0 0 0 4px', fontSize: 10, padding: '1px 4px',
              }}>{"\u2715"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaTab({ data: d, update }: { data: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const allNodes = useProjectStore(s => s.nodes);
  const depIds = d.meta.depends_on;
  return (
    <div>
      <div style={labelS}>File Path</div>
      <input style={inputS} value={d.meta.path} onChange={e => update(d.id, { meta: { ...d.meta, path: e.target.value } })} placeholder="app/page.tsx" />
      <div style={{ ...labelS, marginTop: 12, color: '#e5e5e5' }}>Depends On</div>
      {depIds.map((depId, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
          <span style={{ flex: 1, color: '#a3a3a3', fontFamily: 'monospace' }}>{depId}</span>
          <button onClick={() => update(d.id, { meta: { ...d.meta, depends_on: depIds.filter((_, j) => j !== i) } })} style={{ color: '#525252', fontSize: 11 }}>\u2715</button>
        </div>
      ))}
      <select value="" onChange={e => { if (e.target.value) update(d.id, { meta: { ...d.meta, depends_on: [...depIds, e.target.value] } }); }}
        style={{ width: '100%', padding: '4px 8px', marginTop: 4, fontSize: 11, cursor: 'pointer' }}>
        <option value="">+ Add dependency...</option>
        {allNodes.filter(n => n.id !== d.id && !depIds.includes(n.id)).map(n => (
          <option key={n.id} value={n.id}>{n.id}</option>
        ))}
      </select>
    </div>
  );
}
