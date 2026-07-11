import { useState, useEffect } from 'react';
import { useProjectStore, useOutputStore } from '../../stores/index.js';
import { useCompile } from '../../hooks/useCompile.js';
import { useWebSocket } from '../../hooks/useWebSocket.js';
import { BugsHistoryDialog } from '../dialogs/BugsHistoryDialog.js';
import { DiagnoseDialog } from '../dialogs/DiagnoseDialog.js';
import { XmlPreview } from '../panels/XmlPreview.js';
import { PluginManager } from '../dialogs/PluginManager.js';
import { ProviderSettingsDialog, getPersistedSettings, type ProviderSettings } from '../dialogs/ProviderSettingsDialog.js';
import { SettingsDialog } from '../dialogs/SettingsDialog.js';
import { Icons } from '../icons.js';

const I = ({ Icon, size = 14 }: { Icon: any; size?: number }) => (
  <Icon size={size} strokeWidth={1.5} style={{ flexShrink: 0 }} />
);

export function Toolbar() {
  const [settings, setSettings] = useState<ProviderSettings>(getPersistedSettings);
  const [showOpen, setShowOpen] = useState(false);
  const [showBugs, setShowBugs] = useState(false);
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
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
      if ((e.ctrlKey||e.metaKey)&&e.key===','){e.preventDefault();setShowAppSettings(true);}
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

  const B = (active?: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 12, fontWeight: 500, borderRadius: 4,
    transition: 'all 0.12s', background: active ? '#262626' : 'transparent',
    color: active ? '#e5e5e5' : '#a3a3a3', border: '1px solid transparent',
    display: 'flex', alignItems: 'center', gap: 5,
  });
  const BP: React.CSSProperties = {
    padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 4,
    background: '#e5e5e5', color: '#0a0a0a', border: '1px solid #e5e5e5',
    display: 'flex', alignItems: 'center', gap: 5,
  };

  return (
    <>
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 4,
        background: '#111111', borderBottom: '1px solid #1f1f1f', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.2px', marginRight: 8, color: '#e5e5e5' }}>
          pxml Studio
        </span>

        <button onClick={() => setShowOpen(true)} style={BP}
          onMouseEnter={e => { e.currentTarget.style.background = '#d4d4d4'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#e5e5e5'; }}
        ><I Icon={Icons.folderOpen} /> Open Folder</button>
        <button onClick={saveProject} disabled={!workspacePath} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.save} /> Save{isDirty && ' \u25cf'}</button>
        <Sep />

        <button onClick={() => { setShowSettings(true); setSettings(getPersistedSettings()); }} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          title="Provider Settings"
        >{settings.provider}/{settings.model}</button>
        <button onClick={() => compile()} disabled={!workspacePath || isCompiling} style={isCompiling ? B() : BP}
          onMouseEnter={e => { if (!isCompiling) e.currentTarget.style.background = '#d4d4d4'; }}
          onMouseLeave={e => { if (!isCompiling) e.currentTarget.style.background = '#e5e5e5'; }}
        >
          {isCompiling ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 12, height: 12, border: '2px solid #525252',
                borderTopColor: '#e5e5e5', borderRadius: '50%',
                display: 'inline-block', animation: 'spin 0.8s linear infinite',
              }} />
              Compiling
            </span>
          ) : <><I Icon={Icons.play} /> Compile</>}
        </button>
        <button onClick={() => runTest()} disabled={!workspacePath} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.flask} /> Test</button>
        <button onClick={resetLayout} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.layout} /> Layout</button>
        <Sep />
        <button onClick={() => setShowBugs(true)} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.bug} /> Bugs</button>
        <button onClick={() => setShowDiagnose(true)} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.stethoscope} /> Diagnose</button>
        <button onClick={() => setShowPlugins(true)} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.puzzle} /> Plugins</button>
        <button onClick={() => setShowXml(true)} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.code} /> XML</button>
        <button onClick={handleExport} disabled={!workspacePath} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.download} /> Export</button>
        <Sep />
        <button onClick={undo} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.undo} /></button>
        <button onClick={redo} style={B()}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        ><I Icon={Icons.redo} /></button>
        {selectedNodeId && <>
          <Sep />
          <button onClick={() => runTest(selectedNodeId)} style={B()}
            onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >Test Node</button>
          <button onClick={() => runFix(selectedNodeId)} style={B()}
            onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >Fix Node</button>
        </>}

        <div style={{ flex: 1 }} />

        {workspacePath && (
          <span style={{ fontSize: 11, color: '#525252', marginRight: 8, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {workspacePath.split('/').pop()}
          </span>
        )}
        {cost && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{cost}</span>}
        <button onClick={() => setShowAppSettings(true)} style={{
          ...B(), padding: '4px 8px', color: '#737373', fontSize: 14,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1c1c1c'; e.currentTarget.style.color = '#e5e5e5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#737373'; }}
          title="Settings (Ctrl+,)"
        ><I Icon={Icons.settings} /></button>
      </div>

      {showOpen && <OpenDialog path={openPath} setPath={setOpenPath} onOpen={handleOpen} onClose={() => setShowOpen(false)} />}
      <BugsHistoryDialog open={showBugs} onClose={() => setShowBugs(false)} />
      <DiagnoseDialog open={showDiagnose} onClose={() => setShowDiagnose(false)} />
      <XmlPreview open={showXml} onClose={() => setShowXml(false)} />
      <PluginManager open={showPlugins} onClose={() => setShowPlugins(false)} />
      <ProviderSettingsDialog open={showSettings} onClose={() => { setShowSettings(false); setSettings(getPersistedSettings()); }} />
      <SettingsDialog open={showAppSettings} onClose={() => setShowAppSettings(false)} />
    </>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: '#262626', margin: '0 4px' }} />;
}

function OpenDialog({ path, setPath, onOpen, onClose }: { path: string; setPath: (v: string) => void; onOpen: (p?: string) => void; onClose: () => void }) {
  const [browsePath, setBrowsePath] = useState('');
  const [dirs, setDirs] = useState<{ name: string; hasProjectXml: boolean }[]>([]);
  const [browseParent, setBrowseParent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('pxml-recent') || '[]'); } catch { return []; } });

  useEffect(() => { fetch('/api/home').then(r => r.json()).then(d => { setBrowsePath(d.home || '/'); loadDir(d.home || '/'); }).catch(() => { loadDir('/'); }); }, []);

  async function loadDir(p: string) { setLoading(true); try { const r = await fetch('/api/browse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p }) }); const d = await r.json(); setBrowsePath(d.path); setDirs(d.items || []); setBrowseParent(d.parent); } catch {} setLoading(false); }
  function selectDir(p: string) { setPath(p); const f = dirs.find(d => d.name === p.split('/').pop() && d.hasProjectXml); if (f) { saveRecent(p); onOpen(p); return; } loadDir(p); }
  function saveRecent(p: string) { const u = [p, ...recent.filter(r => r !== p)].slice(0, 10); try { localStorage.setItem('pxml-recent', JSON.stringify(u)); } catch {} }
  function handleOpen(p?: string) {
    const f = (p || path).trim();
    if (!f) return;
    if (!f.startsWith('/')) { alert('Enter full path starting with /'); return; }
    saveRecent(f); onOpen(f);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, padding: 24, width: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease-out' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#e5e5e5' }}>Open Project</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="text" value={path} onChange={e => setPath(e.target.value)} placeholder={browsePath || 'Path to project folder'}
            style={{ flex: 1, padding: '7px 10px', fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && handleOpen()} />
          <button onClick={() => handleOpen()} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, borderRadius: 4, background: '#e5e5e5', color: '#0a0a0a', display: 'flex', alignItems: 'center', gap: 5 }}>Open</button>
        </div>
        <div style={{ border: '1px solid #1f1f1f', borderRadius: 6, overflow: 'hidden', maxHeight: 240, overflowY: 'auto', marginBottom: 8, background: '#0a0a0a' }}>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#525252', borderBottom: '1px solid #1f1f1f', fontFamily: 'monospace' }}>{browsePath}</div>
          {browseParent && (
            <button onClick={() => loadDir(browseParent)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', fontSize: 12, color: '#a3a3a3', textAlign: 'left', borderBottom: '1px solid #1f1f1f' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#171717')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            ><Icons.chevronRight size={12} /> ..</button>
          )}
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#525252' }}>Loading...</div>
          ) : dirs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#525252' }}>Empty</div>
          ) : dirs.map((d, i) => {
            const isPxml = d.hasProjectXml;
            return (
              <button key={i} onClick={() => selectDir(`${browsePath}/${d.name}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', fontSize: 12, color: isPxml ? '#22c55e' : '#e5e5e5', textAlign: 'left', borderBottom: '1px solid #1f1f1f' }}
                onMouseEnter={e => e.currentTarget.style.background = '#171717'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icons.folder size={12} />
                <span style={{ flex: 1 }}>{d.name}</span>
                {isPxml && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 500 }}>pxml</span>}
              </button>
            );
          })}
        </div>
        {recent.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#525252', marginBottom: 6, fontWeight: 600 }}>Recent</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {recent.slice(0, 6).map((r, i) => (
                <button key={i} onClick={() => handleOpen(r)} style={{ padding: '4px 10px', fontSize: 11, color: '#a3a3a3', background: '#171717', border: '1px solid #262626', borderRadius: 4, fontFamily: 'monospace' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#404040'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#262626'; }}
                >{r.split('/').pop()}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
