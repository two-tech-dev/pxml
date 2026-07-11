import React, { useState } from 'react';
import { useProjectStore } from '../../stores/index.js';
import type { NodeData } from '../../types/index.js';

export function NodeEditDialog({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const node = useProjectStore(s => s.nodes.find(n => n.id === nodeId));
  const updateNode = useProjectStore(s => s.updateNode);
  const removeNode = useProjectStore(s => s.removeNode);
  const [tab, setTab] = useState<'basic' | 'fields' | 'constraints' | 'tests' | 'meta'>('basic');

  if (!node) return null;
  const d = node.data;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.6)',
    }} onClick={onClose}>
      <div style={{
        background: '#252526', border: '1px solid #3e3e42', borderRadius: 8,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)', width: 700, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #3e3e42',
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#cccccc' }}>{d.id}</span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 3, marginLeft: 10,
            background: '#1e1e1e', color: '#999999',
          }}>{d.type}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { removeNode(d.id); onClose(); }}
            style={{ color: '#f44747', fontSize: 12, padding: '4px 10px', borderRadius: 3, background: '#1e1e1e' }}>
            Delete
          </button>
          <button onClick={onClose} style={{ color: '#999999', fontSize: 18, marginLeft: 8, padding: '0 4px' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #3e3e42' }}>
          {(['basic', 'fields', 'constraints', 'tests', 'meta'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', fontSize: 12, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#cccccc' : '#999999',
              borderBottom: tab === t ? '2px solid #007acc' : '2px solid transparent',
              background: tab === t ? '#1e1e1e' : 'transparent',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'basic' && <BasicForm d={d} update={updateNode} />}
          {tab === 'fields' && <FieldsForm d={d} update={updateNode} />}
          {tab === 'constraints' && <ConstraintsForm d={d} update={updateNode} />}
          {tab === 'tests' && <TestsForm d={d} update={updateNode} />}
          {tab === 'meta' && <MetaForm d={d} update={updateNode} />}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', padding: '12px 16px',
          borderTop: '1px solid #3e3e42', gap: 8,
        }}>
          <button onClick={onClose}
            style={{ padding: '6px 16px', fontSize: 12, background: '#1e1e1e', borderRadius: 3 }}>
            Cancel
          </button>
          <button onClick={onClose}
            style={{ padding: '6px 16px', fontSize: 12, background: '#cccccc', color: '#fff', borderRadius: 3, fontWeight: 600 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const S = { width: '100%', padding: '5px 8px', fontSize: 12, marginBottom: 10, borderRadius: 3, background: '#1e1e1e', border: '1px solid #3e3e42', color: '#cccccc', outline: 'none' };
const L = { fontSize: 11, color: '#999999', marginBottom: 4, fontWeight: 500 };

function BasicForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div style={L}>ID</div>
        <input value={d.id} onChange={e => update(d.id, { id: e.target.value })} style={S} />
      </div>
      <div>
        <div style={L}>Type</div>
        <select value={d.type} onChange={e => update(d.id, { type: e.target.value as any })} style={S}>
          {['api-route','ui-component','db-model','middleware','config-file','setup-command'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <div style={L}>Flow</div>
        <input value={d.flow} onChange={e => update(d.id, { flow: e.target.value })} style={S} />
      </div>
      <div>
        <div style={L}>Extends</div>
        <input value={d.extends || ''} onChange={e => update(d.id, { extends: e.target.value || undefined })} placeholder="parent ID" style={S} />
      </div>
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.autogenTests} onChange={e => update(d.id, { autogenTests: e.target.checked })} />
          Autogen Tests
        </label>
      </div>
    </div>
  );
}

function FieldsForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const FieldRow = ({ items, onChange, label }: any) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...L, fontSize: 13, color: '#cccccc', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 6, alignItems: 'center' }}>
        <div style={L}>Name</div><div style={L}>Type</div><div style={L}>Req</div><div></div>
        {items.map((f: any, i: number) => (
          <React.Fragment key={i}>
            <input value={f.name} onChange={e => { const c=[...items];c[i]={...c[i],name:e.target.value};onChange(c); }}
              placeholder="name" style={{ ...S, marginBottom: 0 }} />
            <input value={f.type} onChange={e => { const c=[...items];c[i]={...c[i],type:e.target.value};onChange(c); }}
              placeholder="type" style={{ ...S, marginBottom: 0 }} />
            <input type="checkbox" checked={f.required} onChange={e => { const c=[...items];c[i]={...c[i],required:e.target.checked};onChange(c); }} />
            <button onClick={() => onChange(items.filter((_:any,j:number)=>j!==i))}
              style={{ color:'#f44747',fontSize:12,padding:'0 4px' }}>✕</button>
          </React.Fragment>
        ))}
      </div>
      <button onClick={() => onChange([...items, { name:'',type:'string',required:true }])}
        style={{ fontSize:11,color:'#007acc',marginTop:6 }}>+ Add field</button>
    </div>
  );
  return (
    <div>
      <FieldRow items={d.input} onChange={(v: any) => update(d.id, { input: v })} label="Input Fields" />
      <FieldRow items={d.output} onChange={(v: any) => update(d.id, { output: v })} label="Output Fields" />
    </div>
  );
}

function ConstraintsForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      {d.constraints.map((c,i) => (
        <div key={i} style={{ padding:10, marginBottom:10, background:'#1e1e1e', border:'1px solid #3e3e42', borderRadius:4 }}>
          <div style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
            <select value={c.verify} onChange={e => { const cp=[...d.constraints];cp[i]={...cp[i],verify:e.target.value as any};update(d.id,{constraints:cp}); }}
              style={{ padding:'2px 6px',fontSize:11 }}>
              <option value="static">static</option>
              <option value="llm-judge">llm-judge</option>
            </select>
            {c.learnedFrom && <span style={{ fontSize:10,color:'#cca700' }}>from: {c.learnedFrom}</span>}
          </div>
          <textarea value={c.description} onChange={e => { const cp=[...d.constraints];cp[i]={...cp[i],description:e.target.value};update(d.id,{constraints:cp}); }}
            rows={3} style={{ width:'100%',padding:'5px 8px',fontSize:11,resize:'vertical' }} />
          <button onClick={() => update(d.id,{constraints:d.constraints.filter((_,j)=>j!==i)})}
            style={{ fontSize:11,color:'#f44747',marginTop:4 }}>Remove</button>
        </div>
      ))}
      <button onClick={() => update(d.id,{constraints:[...d.constraints,{verify:'static',description:''}]})}
        style={{ fontSize:11,color:'#007acc' }}>+ Add rule</button>
    </div>
  );
}

function TestsForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      {d.tests.map((t,i) => (
        <div key={i} style={{ padding:10, marginBottom:10, background:'#1e1e1e', border:'1px solid #3e3e42', borderRadius:4 }}>
          <input value={t.name} onChange={e => { const cp=[...d.tests];cp[i]={...cp[i],name:e.target.value};update(d.id,{tests:cp}); }}
            placeholder="Test name" style={{ ...S, marginBottom:8 }} />
          <div style={L}>Given (JSON)</div>
          <textarea value={typeof t.given==='string'?t.given:JSON.stringify(t.given,null,2)}
            onChange={e => { const cp=[...d.tests];try{cp[i]={...cp[i],given:JSON.parse(e.target.value)};}catch{}update(d.id,{tests:cp}); }}
            rows={3} style={{ width:'100%',padding:'5px 8px',fontSize:11,resize:'vertical',marginBottom:8,fontFamily:'monospace' }} />
          <div style={L}>Expect (JSON)</div>
          <textarea value={typeof t.expect==='string'?t.expect:JSON.stringify(t.expect,null,2)}
            onChange={e => { const cp=[...d.tests];try{cp[i]={...cp[i],expect:JSON.parse(e.target.value)};}catch{}update(d.id,{tests:cp}); }}
            rows={2} style={{ width:'100%',padding:'5px 8px',fontSize:11,resize:'vertical',fontFamily:'monospace' }} />
          <button onClick={() => update(d.id,{tests:d.tests.filter((_,j)=>j!==i)})}
            style={{ fontSize:11,color:'#f44747',marginTop:4 }}>Remove</button>
        </div>
      ))}
      <button onClick={() => update(d.id,{tests:[...d.tests,{name:'',given:{},expect:{}}]})}
        style={{ fontSize:11,color:'#007acc' }}>+ Add test</button>
    </div>
  );
}

function MetaForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const allNodes = useProjectStore(s => s.nodes);
  const depIds = d.meta.depends_on;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      <div style={{ gridColumn:'1/-1' }}>
        <div style={L}>File Path</div>
        <input value={d.meta.path} onChange={e => update(d.id,{meta:{...d.meta,path:e.target.value}})}
          placeholder="app/page.tsx" style={S} />
      </div>
      <div style={{ gridColumn:'1/-1' }}>
        <div style={{ ...L, marginTop:8, color:'#cccccc' }}>Depends On</div>
        {depIds.map((did,i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',padding:'3px 8px',background:'#1e1e1e',border:'1px solid #3e3e42',borderRadius:3,marginBottom:3,fontSize:12 }}>
            <span style={{ flex:1,color:'#007acc',fontFamily:'monospace' }}>{did}</span>
            <button onClick={() => update(d.id,{meta:{...d.meta,depends_on:depIds.filter((_,j)=>j!==i)}})}
              style={{ color:'#999999',fontSize:11 }}>✕</button>
          </div>
        ))}
        <select value="" onChange={e => { if(e.target.value) update(d.id,{meta:{...d.meta,depends_on:[...depIds,e.target.value]}}); }}
          style={{ ...S, marginTop:6 }}>
          <option value="">+ Add dependency...</option>
          {allNodes.filter(n=>n.id!==d.id&&!depIds.includes(n.id)).map(n=>(
            <option key={n.id} value={n.id}>{n.id}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
