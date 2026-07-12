import React, { useState } from 'react';
import { useProjectStore } from '../../stores/index.js';
import type { NodeData } from '../../types/index.js';
import { X, Trash2, Plus, ChevronRight } from 'lucide-react';

export function NodeEditDialog({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const node = useProjectStore(s => s.nodes.find(n => n.id === nodeId));
  const updateNode = useProjectStore(s => s.updateNode);
  const removeNode = useProjectStore(s => s.removeNode);
  const [tab, setTab] = useState<'basic' | 'fields' | 'constraints' | 'tests' | 'meta'>('basic');

  if (!node) return null;
  const d = node.data;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#111111', border: '1px solid #262626', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', width: 920, height: '88vh', maxHeight: 800, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.15s ease-out', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #1f1f1f', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#e5e5e5', letterSpacing: '-0.2px' }}>{d.id}</div>
            <div style={{ fontSize: 11, color: '#525252', marginTop: 2 }}>{d.type} {d.flow !== 'default' && `· ${d.flow}`}</div>
          </div>
          <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: '#1c1c1c', color: '#737373', border: '1px solid #262626', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d.type}</span>
          {d.extends && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.15)' }}>extends {d.extends}</span>}
          <div style={{ flex: 1 }} />
          <button onClick={() => { removeNode(d.id); onClose(); }}
            style={{ color: '#ef4444', fontSize: 12, padding: '6px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          ><Trash2 size={13} /> Delete</button>
          <button onClick={onClose} style={{ color: '#525252', padding: '6px 8px', borderRadius: 6, marginLeft: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          ><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1f1f1f', gap: 0, padding: '0 12px', flexShrink: 0, background: '#0a0a0a' }}>
          {(['basic', 'fields', 'constraints', 'tests', 'meta'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 12, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#e5e5e5' : '#737373',
              borderBottom: tab === t ? '2px solid #e5e5e5' : '2px solid transparent',
              background: 'transparent', transition: 'all 0.1s',
              letterSpacing: '-0.2px',
            }}
              onMouseEnter={e => { if (tab !== t) e.currentTarget.style.color = '#a3a3a3'; }}
              onMouseLeave={e => { if (tab !== t) e.currentTarget.style.color = '#737373'; }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 24px', background: '#0a0a0a' }}>
          {tab === 'basic' && <BasicForm d={d} update={updateNode} />}
          {tab === 'fields' && <FieldsForm d={d} update={updateNode} />}
          {tab === 'constraints' && <ConstraintsForm d={d} update={updateNode} />}
          {tab === 'tests' && <TestsForm d={d} update={updateNode} />}
          {tab === 'meta' && <MetaForm d={d} update={updateNode} />}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #1f1f1f', gap: 8, background: '#111111', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', fontSize: 12, background: 'transparent', borderRadius: 6, color: '#a3a3a3', border: '1px solid #262626', fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >Cancel</button>
          <button onClick={onClose} style={{ padding: '7px 18px', fontSize: 12, background: '#e5e5e5', color: '#0a0a0a', borderRadius: 6, fontWeight: 600 }}>Done</button>
        </div>
      </div>
    </div>
  );
}

const inputClass = (wide?: boolean): React.CSSProperties => ({
  padding: '8px 10px', fontSize: 13, borderRadius: 6, width: '100%',
  background: '#171717', border: '1px solid #262626', color: '#e5e5e5',
  outline: 'none', fontFamily: "'JetBrains Mono',monospace",
  transition: 'border-color 0.15s',
});

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#737373', marginBottom: 6, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' };

function sectionLabel(text: string) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5', marginBottom: 16, letterSpacing: '-0.2px' }}>{text}</div>;
}

function BasicForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const allNodes = useProjectStore(s => s.nodes);
  const packageNodes = useProjectStore(s => s.packageNodes);
  const visibleIds = new Set(allNodes.map(n => n.data.id));
  const merged = [...allNodes.map(n => n.data), ...packageNodes.filter(pn => !visibleIds.has(pn.id))];
  const extendsOptions = merged.filter(n => n.id !== d.id && !n.extends);
  const existingFlows = [...new Set(allNodes.map(n => n.data.flow).filter(Boolean))];

  const row = (left: React.ReactNode, right: React.ReactNode, wide?: boolean) => (
    <div style={{ display: wide ? 'block' : 'grid', gridTemplateColumns: wide ? undefined : '1fr 1fr', gap: 16, marginBottom: 14 }}>
      <div>
        <div style={labelStyle}>{left}</div>
        {right}
      </div>
    </div>
  );

  return (
    <div>
      {sectionLabel('Basic Information')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={labelStyle}>Node ID</div>
          <input value={d.id} onChange={e => update(d.id, { id: e.target.value })} style={inputClass()} />
        </div>
        <div>
          <div style={labelStyle}>Type</div>
          <select value={d.type} onChange={e => update(d.id, { type: e.target.value as any })} style={{...inputClass(), cursor:'pointer'}}>
            {['api-route','ui-component','db-model','middleware','config-file','setup-command'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Flow</div>
          <select value={d.flow} onChange={e => update(d.id, { flow: e.target.value })} style={{...inputClass(), cursor:'pointer'}}>
            <option value="default">default</option>
            {existingFlows.filter(f => f !== d.flow && f !== 'default').map(f => <option key={f} value={f}>{f}</option>)}
            {d.flow && !existingFlows.includes(d.flow) && <option value={d.flow}>{d.flow}</option>}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Extends</div>
          <select value={d.extends || ''} onChange={e => update(d.id, { extends: e.target.value || undefined })} style={{...inputClass(), cursor:'pointer'}}>
            <option value="">— none —</option>
            {extendsOptions.map(n => <option key={n.id} value={n.id}>{n.id}{n.id.includes(':') ? ' (pkg)' : ''}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 16, padding: '10px 14px', background: '#111111', borderRadius: 8, border: '1px solid #1f1f1f', display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#a3a3a3', cursor: 'pointer', fontWeight: 500 }}>
          <input type="checkbox" checked={d.autogenTests} onChange={e => update(d.id, { autogenTests: e.target.checked })} /> Auto-generate tests for this node
        </label>
      </div>
    </div>
  );
}

function FieldsForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const FieldRow = ({ items, onChange, label }: any) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5' }}>{label}</div>
        <span style={{ fontSize: 10, background: '#171717', padding: '2px 8px', borderRadius: 8, color: '#525252', border: '1px solid #262626' }}>{items.length}</span>
      </div>
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto auto', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <div style={{...labelStyle, marginBottom: 0}}>Name</div>
          <div style={{...labelStyle, marginBottom: 0}}>Type</div>
          <div style={{...labelStyle, marginBottom: 0, fontSize: 10}}>Req</div>
          <div></div>
        </div>
      )}
      {items.map((f: any, i: number) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <input value={f.name} onChange={e => { const c=[...items];c[i]={...c[i],name:e.target.value};onChange(c); }} placeholder="fieldName" style={inputClass()} />
          <input value={f.type} onChange={e => { const c=[...items];c[i]={...c[i],type:e.target.value};onChange(c); }} placeholder="string" style={inputClass()} />
          <input type="checkbox" checked={f.required} onChange={e => { const c=[...items];c[i]={...c[i],required:e.target.checked};onChange(c); }} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#e5e5e5' }} />
          <button onClick={() => onChange(items.filter((_:any,j:number)=>j!==i))} style={{ color:'#525252',padding:'4px 6px',borderRadius:4 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
          ><X size={13} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { name:'',type:'string',required:true }])} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#737373', padding: '8px 14px', borderRadius: 6, background: '#111111', border: '1px dashed #262626', width: '100%', justifyContent: 'center', fontWeight: 500 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#a3a3a3'; e.currentTarget.style.borderColor = '#404040'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.borderColor = '#262626'; }}
      ><Plus size={14} /> Add {label.split(' ')[0].toLowerCase()}</button>
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
      {sectionLabel('Constraints')}
      {d.constraints.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#525252', background: '#111111', borderRadius: 8, border: '1px solid #1f1f1f', marginBottom: 12 }}>
          No constraints defined.<br />
          <span style={{ fontSize: 11, color: '#404040' }}>Add rules to validate this node automatically.</span>
        </div>
      )}
      {d.constraints.map((c,i) => (
        <div key={i} style={{ padding: 14, marginBottom: 10, background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8 }}>
          <div style={{ display:'flex', gap: 10, marginBottom: 10, alignItems:'center' }}>
            <select value={c.verify} onChange={e => { const cp=[...d.constraints];cp[i]={...cp[i],verify:e.target.value as any};update(d.id,{constraints:cp}); }}
              style={{ padding: '5px 10px', fontSize: 11, cursor: 'pointer', background: '#0a0a0a', border: '1px solid #262626', borderRadius: 6, color: '#a3a3a3', fontWeight: 600 }}>
              <option value="static">static</option><option value="llm-judge">llm-judge</option>
            </select>
            {c.learnedFrom && <span style={{ fontSize: 10, color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '2px 8px', borderRadius: 4 }}>learned: {c.learnedFrom}</span>}
            <div style={{ flex: 1 }} />
            <button onClick={() => update(d.id,{constraints:d.constraints.filter((_,j)=>j!==i)})} style={{ fontSize: 11, color: '#525252', padding: '4px 8px', borderRadius: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
            >Remove</button>
          </div>
          <textarea value={c.description} onChange={e => { const cp=[...d.constraints];cp[i]={...cp[i],description:e.target.value};update(d.id,{constraints:cp}); }}
            rows={3} placeholder="Describe the constraint rule..."
            style={{ width: '100%', padding: '8px 10px', fontSize: 12, resize: 'vertical', background: '#0a0a0a', border: '1px solid #262626', borderRadius: 6, color: '#e5e5e5', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5 }} />
        </div>
      ))}
      <button onClick={() => update(d.id,{constraints:[...d.constraints,{verify:'static',description:''}]})}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#737373', padding: '8px 14px', borderRadius: 6, background: '#111111', border: '1px dashed #262626', width: '100%', justifyContent: 'center', fontWeight: 500 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#a3a3a3'; e.currentTarget.style.borderColor = '#404040'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.borderColor = '#262626'; }}
      ><Plus size={14} /> Add constraint</button>
    </div>
  );
}

function TestsForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  return (
    <div>
      {sectionLabel('Tests')}
      {d.tests.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#525252', background: '#111111', borderRadius: 8, border: '1px solid #1f1f1f', marginBottom: 12 }}>
          No test cases defined.<br />
          <span style={{ fontSize: 11, color: '#404040' }}>Tests are auto-generated during compile if autogen is enabled.</span>
        </div>
      )}
      {d.tests.map((t,i) => (
        <div key={i} style={{ padding: 14, marginBottom: 10, background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input value={t.name} onChange={e => { const cp=[...d.tests];cp[i]={...cp[i],name:e.target.value};update(d.id,{tests:cp}); }}
              placeholder="Test case name" style={{ ...inputClass(), marginBottom: 0, flex: 1 }} />
            <button onClick={() => update(d.id,{tests:d.tests.filter((_,j)=>j!==i)})} style={{ fontSize: 11, color: '#525252', padding: '4px 8px', borderRadius: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
            >Remove</button>
          </div>
          <div style={labelStyle}>Given (JSON)</div>
          <textarea value={typeof t.given==='string'?t.given:JSON.stringify(t.given,null,2)}
            onChange={e => { const cp=[...d.tests];try{cp[i]={...cp[i],given:JSON.parse(e.target.value)};}catch{}update(d.id,{tests:cp}); }}
            rows={4} style={{ width: '100%', padding: '8px 10px', fontSize: 12, resize: 'vertical', marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", background: '#0a0a0a', border: '1px solid #262626', borderRadius: 6, color: '#e5e5e5', outline: 'none', lineHeight: 1.5 }} />
          <div style={labelStyle}>Expect (JSON)</div>
          <textarea value={typeof t.expect==='string'?t.expect:JSON.stringify(t.expect,null,2)}
            onChange={e => { const cp=[...d.tests];try{cp[i]={...cp[i],expect:JSON.parse(e.target.value)};}catch{}update(d.id,{tests:cp}); }}
            rows={3} style={{ width: '100%', padding: '8px 10px', fontSize: 12, resize: 'vertical', fontFamily: "'JetBrains Mono',monospace", background: '#0a0a0a', border: '1px solid #262626', borderRadius: 6, color: '#e5e5e5', outline: 'none', lineHeight: 1.5 }} />
        </div>
      ))}
      <button onClick={() => update(d.id,{tests:[...d.tests,{name:'New test',given:{},expect:{}}]})}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#737373', padding: '8px 14px', borderRadius: 6, background: '#111111', border: '1px dashed #262626', width: '100%', justifyContent: 'center', fontWeight: 500 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#a3a3a3'; e.currentTarget.style.borderColor = '#404040'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.borderColor = '#262626'; }}
      ><Plus size={14} /> Add test case</button>
    </div>
  );
}

function MetaForm({ d, update }: { d: NodeData; update: (id: string, p: Partial<NodeData>) => void }) {
  const allNodes = useProjectStore(s => s.nodes);
  const packageNodes = useProjectStore(s => s.packageNodes);
  const depIds = d.meta.depends_on;
  const visibleIds = new Set(allNodes.map(n => n.data.id));
  const allCandidate = [...allNodes.map(n => n.data), ...packageNodes.filter(pn => !visibleIds.has(pn.id))];
  const available = allCandidate.filter(n => n.id !== d.id && !depIds.includes(n.id));
  return (
    <div>
      {sectionLabel('Meta')}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>File Path</div>
        <input value={d.meta.path} onChange={e => update(d.id,{meta:{...d.meta,path:e.target.value}})} placeholder="app/page.tsx" style={inputClass()} />
        <div style={{ fontSize: 10, color: '#404040', marginTop: 4 }}>Relative path from project root</div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5' }}>Depends On</div>
          <span style={{ fontSize: 10, background: '#171717', padding: '2px 8px', borderRadius: 8, color: '#525252', border: '1px solid #262626' }}>{depIds.length}</span>
        </div>
        {depIds.length === 0 && (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#525252', background: '#111111', borderRadius: 8, border: '1px solid #1f1f1f', marginBottom: 10 }}>
            No dependencies — this node can be compiled first.
          </div>
        )}
        {depIds.map((did,i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', background: '#171717', border: '1px solid #262626', borderRadius: 6, marginBottom: 6, fontSize: 12, gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 3, background: '#eab308', flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#a3a3a3', fontFamily: 'monospace' }}>{did}</span>
            <button onClick={() => update(d.id,{meta:{...d.meta,depends_on:depIds.filter((_,j)=>j!==i)}})} style={{ color: '#525252',padding:'2px 4px',borderRadius:4 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#525252'; e.currentTarget.style.background = 'transparent'; }}
            ><X size={12} /></button>
          </div>
        ))}
        <select value="" onChange={e => { if(e.target.value) update(d.id,{meta:{...d.meta,depends_on:[...depIds,e.target.value]}}); }}
          style={{ ...inputClass(), marginTop: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
          <option value="">+ Add dependency...</option>
          {available.map(n => <option key={n.id} value={n.id}>{n.id}{n.id.includes(':') ? ' (pkg)' : ''}</option>)}
        </select>
      </div>
    </div>
  );
}
