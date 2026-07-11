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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #1f1f1f' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#e5e5e5' }}>{d.id}</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, marginLeft: 10, background: '#0a0a0a', color: '#737373', border: '1px solid #262626' }}>{d.type}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => { removeNode(d.id); onClose(); }}
            style={{ color: '#ef4444', fontSize: 12, padding: '4px 10px', borderRadius: 4, background: 'rgba(239,68,68,0.1)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
          >Delete</button>
          <button onClick={onClose} style={{ color: '#525252', fontSize: 18, marginLeft: 8, padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          >{"\u2715"}</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #1f1f1f' }}>
          {(['basic', 'fields', 'constraints', 'tests', 'meta'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', fontSize: 12, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#e5e5e5' : '#737373',
              borderBottom: tab === t ? '2px solid #e5e5e5' : '2px solid transparent',
              background: tab === t ? '#171717' : 'transparent',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'basic' && <BasicForm d={d} update={updateNode} />}
          {tab === 'fields' && <FieldsForm d={d} update={updateNode} />}
          {tab === 'constraints' && <ConstraintsForm d={d} update={updateNode} />}
          {tab === 'tests' && <TestsForm d={d} update={updateNode} />}
          {tab === 'meta' && <MetaForm d={d} update={updateNode} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid #1f1f1f', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, background: '#171717', borderRadius: 4, color: '#a3a3a3', border: '1px solid #262626' }}>Cancel</button>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, background: '#e5e5e5', color: '#0a0a0a', borderRadius: 4, fontWeight: 600 }}>Done</button>
        </div>
      </div>
    </div>
  );
}

const S: React.CSSProperties = { width: '100%', padding: '5px 8px', fontSize: 12, marginBottom: 10, borderRadius: 4, background: '#0a0a0a', border: '1px solid #262626', color: '#e5e5e5', outline: 'none' };
const L: React.CSSProperties = { fontSize: 11, color: '#737373', marginBottom: 4, fontWeight: 500 };

function BasicForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const allNodes = useProjectStore(s => s.nodes);
  const extendsOptions = allNodes.filter(n => n.id !== d.id && !n.data.extends);
  const existingFlows = [...new Set(allNodes.map(n => n.data.flow).filter(Boolean))];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><div style={L}>ID</div><input value={d.id} onChange={e => update(d.id, { id: e.target.value })} style={S} /></div>
      <div><div style={L}>Type</div><select value={d.type} onChange={e => update(d.id, { type: e.target.value as any })} style={{...S, cursor:'pointer'}}>
        {['api-route','ui-component','db-model','middleware','config-file','setup-command'].map(t => <option key={t} value={t}>{t}</option>)}
      </select></div>
      <div><div style={L}>Flow</div>
        <select value={d.flow} onChange={e => update(d.id, { flow: e.target.value })} style={{...S, cursor:'pointer'}}>
          <option value="default">default</option>
          {existingFlows.filter(f => f !== d.flow && f !== 'default').map(f => <option key={f} value={f}>{f}</option>)}
          {d.flow && !existingFlows.includes(d.flow) && <option value={d.flow}>{d.flow}</option>}
        </select>
      </div>
      <div><div style={L}>Extends</div>
        <select value={d.extends || ''} onChange={e => update(d.id, { extends: e.target.value || undefined })} style={{...S, cursor:'pointer'}}>
          <option value="">(none)</option>
          {extendsOptions.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={d.autogenTests} onChange={e => update(d.id, { autogenTests: e.target.checked })} /> Autogen Tests
      </label></div>
    </div>
  );
}

function FieldsForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const FieldRow = ({ items, onChange, label }: any) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...L, fontSize: 13, color: '#e5e5e5', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 6, alignItems: 'center' }}>
        <div style={L}>Name</div><div style={L}>Type</div><div style={L}>Req</div><div></div>
        {items.map((f: any, i: number) => (
          <React.Fragment key={i}>
            <input value={f.name} onChange={e => { const c=[...items];c[i]={...c[i],name:e.target.value};onChange(c); }} placeholder="name" style={{ ...S, marginBottom: 0 }} />
            <input value={f.type} onChange={e => { const c=[...items];c[i]={...c[i],type:e.target.value};onChange(c); }} placeholder="type" style={{ ...S, marginBottom: 0 }} />
            <input type="checkbox" checked={f.required} onChange={e => { const c=[...items];c[i]={...c[i],required:e.target.checked};onChange(c); }} />
            <button onClick={() => onChange(items.filter((_:any,j:number)=>j!==i))} style={{ color:'#ef4444',fontSize:12,padding:'0 4px' }}>{"\u2715"}</button>
          </React.Fragment>
        ))}
      </div>
      <button onClick={() => onChange([...items, { name:'',type:'string',required:true }])} style={{ fontSize:11,color:'#a3a3a3',marginTop:6 }}>+ Add field</button>
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
        <div key={i} style={{ padding:10, marginBottom:10, background:'#0a0a0a', border:'1px solid #1f1f1f', borderRadius:6 }}>
          <div style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
            <select value={c.verify} onChange={e => { const cp=[...d.constraints];cp[i]={...cp[i],verify:e.target.value as any};update(d.id,{constraints:cp}); }}
              style={{ padding:'2px 6px',fontSize:11, cursor:'pointer' }}>
              <option value="static">static</option><option value="llm-judge">llm-judge</option>
            </select>
            {c.learnedFrom && <span style={{ fontSize:10,color:'#eab308' }}>from: {c.learnedFrom}</span>}
          </div>
          <textarea value={c.description} onChange={e => { const cp=[...d.constraints];cp[i]={...cp[i],description:e.target.value};update(d.id,{constraints:cp}); }}
            rows={3} style={{ width:'100%',padding:'5px 8px',fontSize:11,resize:'vertical' }} />
          <button onClick={() => update(d.id,{constraints:d.constraints.filter((_,j)=>j!==i)})} style={{ fontSize:11,color:'#ef4444',marginTop:4 }}>Remove</button>
        </div>
      ))}
      <button onClick={() => update(d.id,{constraints:[...d.constraints,{verify:'static',description:''}]})} style={{ fontSize:11,color:'#a3a3a3' }}>+ Add rule</button>
    </div>
  );
}

function TestsForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      {d.tests.map((t,i) => (
        <div key={i} style={{ padding:10, marginBottom:10, background:'#0a0a0a', border:'1px solid #1f1f1f', borderRadius:6 }}>
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
          <button onClick={() => update(d.id,{tests:d.tests.filter((_,j)=>j!==i)})} style={{ fontSize:11,color:'#ef4444',marginTop:4 }}>Remove</button>
        </div>
      ))}
      <button onClick={() => update(d.id,{tests:[...d.tests,{name:'',given:{},expect:{}}]})} style={{ fontSize:11,color:'#a3a3a3' }}>+ Add test</button>
    </div>
  );
}

function MetaForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const allNodes = useProjectStore(s => s.nodes);
  const depIds = d.meta.depends_on;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      <div style={{ gridColumn:'1/-1' }}><div style={L}>File Path</div>
        <input value={d.meta.path} onChange={e => update(d.id,{meta:{...d.meta,path:e.target.value}})} placeholder="app/page.tsx" style={S} /></div>
      <div style={{ gridColumn:'1/-1' }}>
        <div style={{ ...L, marginTop:8, color:'#e5e5e5' }}>Depends On</div>
        {depIds.map((did,i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',padding:'4px 8px',background:'#0a0a0a',border:'1px solid #1f1f1f',borderRadius:4,marginBottom:4,fontSize:12 }}>
            <span style={{ flex:1,color:'#a3a3a3',fontFamily:'monospace' }}>{did}</span>
            <button onClick={() => update(d.id,{meta:{...d.meta,depends_on:depIds.filter((_,j)=>j!==i)}})} style={{ color:'#525252',fontSize:11 }}>{"\u2715"}</button>
          </div>
        ))}
        <select value="" onChange={e => { if(e.target.value) update(d.id,{meta:{...d.meta,depends_on:[...depIds,e.target.value]}}); }}
          style={{ ...S, marginTop:6, cursor:'pointer' }}>
          <option value="">+ Add dependency...</option>
          {allNodes.filter(n=>n.id!==d.id&&!depIds.includes(n.id)).map(n=>(<option key={n.id} value={n.id}>{n.id}</option>))}
        </select>
      </div>
    </div>
  );
}
