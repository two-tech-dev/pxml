import { useState, useEffect } from 'react';
import { useProjectStore, useOutputStore } from '../../stores/index.js';
import { useCompile } from '../../hooks/useCompile.js';
import { useWebSocket } from '../../hooks/useWebSocket.js';
import { BugsHistoryDialog } from '../dialogs/BugsHistoryDialog.js';
import { DiagnoseDialog } from '../dialogs/DiagnoseDialog.js';
import { XmlPreview } from '../panels/XmlPreview.js';
import { PluginManager } from '../dialogs/PluginManager.js';
import { ProviderSettingsDialog, getPersistedSettings, type ProviderSettings } from '../dialogs/ProviderSettingsDialog.js';

export function Toolbar() {
  const [settings, setSettings] = useState<ProviderSettings>(getPersistedSettings);
  const [showOpen, setShowOpen] = useState(false);
  const [showBugs, setShowBugs] = useState(false);
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [openPath, setOpenPath] = useState('');

  const isCompiling = useOutputStore(s => s.isCompiling);
  const costSummary = useOutputStore(s => s.costSummary);
  const workspacePath = useProjectStore(s => s.workspacePath);
  const project = useProjectStore(s => s.project);
  const openProject = useProjectStore(s => s.openProject);
  const saveProject = useProjectStore(s => s.saveProject);
  const isDirty = useProjectStore(s => s.isDirty);
  const selectedNodeId = useProjectStore(s => s.selectedNodeId);
  const resetLayout = useProjectStore(s => s.resetLayout);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const exportXml = useProjectStore(s => s.exportXml);
  const append = useOutputStore(s => s.append);

  const { compile, handleWsMessage } = useCompile(settings);
  useWebSocket(handleWsMessage);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveProject();}
      if ((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
      if ((e.ctrlKey||e.metaKey)&&e.key==='z'&&e.shiftKey){e.preventDefault();redo();}
    };
    window.addEventListener('keydown', h);
    return ()=>window.removeEventListener('keydown', h);
  }, [saveProject,undo,redo]);

  async function handleOpen(p?: string) { const f = (p ?? openPath).trim(); if(!f) return; try { await openProject(f); setShowOpen(false); } catch(e:any){ alert(e.message); } }
  async function runTest(nodeId?: string) {
    if(!workspacePath) return; append({type:'info',message:`Running tests${nodeId?' for '+nodeId:''}...`});
    const r = await fetch('/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:workspacePath,nodeId})});
    const d = await r.json(); append({type:d.passed?'success':'error',message:d.message});
  }
  async function runFix(nodeId:string) {
    if(!workspacePath) return; append({type:'info',message:`Starting fix for ${nodeId}...`});
    await fetch('/api/fix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:workspacePath,nodeId})});
  }
  async function handleExport() { const p = await exportXml(); if(p) append({type:'success',message:`Exported to ${p}`}); }

  const cost = costSummary ? `$${((costSummary.inputTokens*0.000003)+(costSummary.outputTokens*0.000015)).toFixed(3)}` : null;
  const B = (bg?:string) => ({ padding:'5px 12px', fontSize:12, fontWeight:500, borderRadius:6, transition:'all 0.15s', background:bg || '#252526', color:'#cccccc', border:'1px solid #3e3e42' }) as React.CSSProperties;
  const BP = { ...B('#007acc'), color:'#fff', border:'1px solid #007acc', fontWeight:600 };

  return (
    <>
      <div style={{ height:40,display:'flex',alignItems:'center',padding:'0 10px',gap:6,background:'#1e1e1e',borderBottom:'1px solid #3e3e42',flexShrink:0 }}>
        <span style={{ fontWeight:800,fontSize:14,color:'#007acc',letterSpacing:'-0.3px',marginRight:4 }}>⧩ pxml Studio</span>
        <button onClick={()=>setShowOpen(true)} style={BP}>Open Folder</button>
        <button onClick={saveProject} disabled={!workspacePath} style={B()}>{isDirty?'Save ●':'Save'}</button>
        <div style={{width:1,height:22,background:'#3e3e42',margin:'0 4px'}} />

        <button onClick={() => { setShowSettings(true); setSettings(getPersistedSettings()); }} style={B()} title="Provider Settings">
          ⚙ {settings.provider}/{settings.model}
        </button>
        <button onClick={()=>compile()} disabled={!workspacePath||isCompiling} style={isCompiling?B():BP}>
          {isCompiling ? <><span style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite',marginRight:4}} />Compiling</> : '▶ Compile'}
        </button>
        <button onClick={()=>runTest()} disabled={!workspacePath} style={B()}>🧪 Test</button>
        <button onClick={resetLayout} style={B()}>Layout</button>
        <div style={{width:1,height:22,background:'#3e3e42',margin:'0 4px'}} />
        <button onClick={()=>setShowBugs(true)} style={B()}>🐛 Bugs</button>
        <button onClick={()=>setShowDiagnose(true)} style={B()}>Diagnose</button>
        <button onClick={()=>setShowPlugins(true)} style={B()}>Plugins</button>
        <button onClick={()=>setShowXml(true)} style={B()}>XML</button>
        <button onClick={handleExport} disabled={!workspacePath} style={B()}>Export</button>
        <div style={{width:1,height:22,background:'#3e3e42',margin:'0 4px'}} />
        <button onClick={undo} style={B()}>↶</button>
        <button onClick={redo} style={B()}>↷</button>
        {selectedNodeId && <><div style={{width:1,height:22,background:'#3e3e42',margin:'0 4px'}} />
          <button onClick={()=>runTest(selectedNodeId)} style={B()}>Test Node</button>
          <button onClick={()=>runFix(selectedNodeId)} style={B()}>Fix Node</button></>}
        <div style={{flex:1}} />
        {workspacePath && <span style={{fontSize:11,color:'#999999',marginRight:8,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{workspacePath.split('/').pop()}</span>}
        {cost && <span style={{fontSize:11,color:'#89d185',fontWeight:700}}>{cost}</span>}
      </div>
      {showOpen && <OpenDialog path={openPath} setPath={setOpenPath} onOpen={handleOpen} onClose={()=>setShowOpen(false)} />}
      <BugsHistoryDialog open={showBugs} onClose={()=>setShowBugs(false)} />
      <DiagnoseDialog open={showDiagnose} onClose={()=>setShowDiagnose(false)} />
      <XmlPreview open={showXml} onClose={()=>setShowXml(false)} />
      <PluginManager open={showPlugins} onClose={()=>setShowPlugins(false)} />
      <ProviderSettingsDialog open={showSettings} onClose={() => { setShowSettings(false); setSettings(getPersistedSettings()); }} />
    </>
  );
}

function OpenDialog({ path, setPath, onOpen, onClose }: { path:string;setPath:(v:string)=>void;onOpen:(p?:string)=>void;onClose:()=>void }) {
  const [browsePath,setBrowsePath]=useState('');
  const [dirs,setDirs]=useState<{name:string;hasProjectXml:boolean}[]>([]);
  const [browseParent,setBrowseParent]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [recent,setRecent]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('pxml-recent')||'[]')}catch{return[]}});

  useEffect(()=>{fetch('/api/home').then(r=>r.json()).then(d=>{setBrowsePath(d.home||'/');loadDir(d.home||'/');}).catch(()=>{loadDir('/');});},[]);

  async function loadDir(p:string){setLoading(true);try{const r=await fetch('/api/browse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p})});const d=await r.json();setBrowsePath(d.path);setDirs(d.items||[]);setBrowseParent(d.parent);}catch{}setLoading(false);}
  function selectDir(p:string){setPath(p);const f=dirs.find(d=>d.name===p.split('/').pop()&&d.hasProjectXml);if(f){saveRecent(p);onOpen(p);return;}loadDir(p);}
  function saveRecent(p:string){const u=[p,...recent.filter(r=>r!==p)].slice(0,10);try{localStorage.setItem('pxml-recent',JSON.stringify(u))}catch{}}
  function handleOpen(p?:string){
    const f = (p||path).trim();
    if(!f) return;
    if(!f.startsWith('/')){
      alert('Enter full path starting with /  (e.g. /home/user/project)');
      return;
    }
    saveRecent(f);
    onOpen(f);
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
      <div style={{background:'#252526',border:'1px solid #3e3e42',borderRadius:10,padding:24,width:560,boxShadow:'0 16px 48px rgba(0,0,0,0.5)',animation:'fadeIn 0.2s ease-out'}}>
        <h3 style={{margin:'0 0 14px',fontSize:17,fontWeight:700,color:'#cccccc'}}>Open Project</h3>
        <div style={{display:'flex',gap:8,marginBottom:6}}>
          <input type="text" value={path} onChange={e=>setPath(e.target.value)} placeholder={browsePath||'Path to project folder'} style={{flex:1,padding:'8px 12px',fontSize:13}} onKeyDown={e=>e.key==='Enter'&&handleOpen()} />
          <button onClick={()=>handleOpen()} style={{padding:'8px 20px',background:'#007acc',color:'#fff',borderRadius:6,fontSize:13,fontWeight:600}}>Open</button>
        </div>
        <div style={{border:'1px solid #3e3e42',borderRadius:8,overflow:'hidden',maxHeight:240,overflowY:'auto',marginBottom:8,background:'#1e1e1e'}}>
          <div style={{padding:'6px 12px',fontSize:11,color:'#999999',borderBottom:'1px solid #3e3e42',display:'flex',alignItems:'center',gap:6,fontFamily:'monospace'}}>
            📁 {browsePath}
          </div>
          {browseParent && <button onClick={()=>loadDir(browseParent)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 12px',fontSize:12,color:'#007acc',textAlign:'left',borderBottom:'1px solid #3e3e42'}}>📂 ..</button>}
          {loading ? <div style={{padding:20,textAlign:'center',fontSize:12,color:'#999999'}}>Loading...</div> :
           dirs.length===0 ? <div style={{padding:20,textAlign:'center',fontSize:12,color:'#858585'}}>Empty</div> :
           dirs.map((d,i) => {
             const isPxml = d.hasProjectXml;
             return (
               <button key={i}
                 onClick={() => selectDir(`${browsePath}/${d.name}`)}
                 style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 12px',fontSize:12,color:isPxml?'#89d185':'#cccccc',textAlign:'left',borderBottom:'1px solid #3e3e42'}}
                 onMouseEnter={e => e.currentTarget.style.background='#2a2d2e'}
                 onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                 <span>{isPxml ? '📦' : '📁'}</span>
                 <span style={{flex:1}}>{d.name}</span>
                 {isPxml && <span style={{fontSize:10,color:'#89d185',fontWeight:600}}>pxml</span>}
               </button>
             );
           })}
        </div>
        {recent.length>0 && <div>
          <div style={{fontSize:11,color:'#999999',marginBottom:6,fontWeight:600}}>Recent</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {recent.slice(0,6).map((r,i) => (
              <button key={i} onClick={() => handleOpen(r)} style={{padding:'5px 12px',fontSize:11,color:'#007acc',background:'#252526',border:'1px solid #3e3e42',borderRadius:6,fontFamily:'monospace'}}>
                {r.split('/').pop()}
              </button>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
}
