import { useOutputStore } from '../../stores/index.js';

export function OutputPanel() {
  const lines = useOutputStore(s => s.lines);
  const clear = useOutputStore(s => s.clear);

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',background:'#1e1e1e',fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      <div style={{ display:'flex',alignItems:'center',padding:'0 14px',height:28,borderBottom:'1px solid #3e3e42',gap:8,flexShrink:0 }}>
        <span style={{ fontSize:11,fontWeight:600,color:'#999999',textTransform:'uppercase',letterSpacing:'0.3px' }}>Output</span>
        <span style={{ fontSize:10,background:'#252526',padding:'1px 6px',borderRadius:10,color:'#858585' }}>{lines.length}</span>
        <div style={{ flex:1 }} />
        <button onClick={clear} style={{ fontSize:11,color:'#999999',padding:'2px 8px',borderRadius:4 }}>Clear</button>
      </div>
      <div style={{ flex:1,overflowY:'auto',padding:'2px 0' }}>
        {lines.length===0 && <div style={{ padding:24,textAlign:'center',fontSize:12,color:'#858585',lineHeight:1.6 }}>Output appears here<br/>when you compile, test, or fix nodes.</div>}
        {lines.map((line,i)=>{
          const color = line.type==='error'?'#f44747':line.type==='success'?'#89d185':line.type==='warn'?'#cca700':'#999999';
          const prefix = line.type==='error'?'✕':line.type==='success'?'✓':line.type==='warn'?'⚠':'·';
          return (
            <div key={i} style={{ padding:'2px 14px',fontSize:12,color,display:'flex',alignItems:'baseline',gap:8,
              background:line.type==='error'?'rgba(244,71,71,0.15)':line.type==='warn'?'rgba(204,167,0,0.15)':'transparent',
              borderLeft:line.type==='error'?'3px solid #f44747':line.type==='warn'?'3px solid #cca700':'3px solid transparent',
            }}>
              <span style={{ color:'#858585',fontSize:10,minWidth:70 }}>{new Date(line.timestamp).toLocaleTimeString()}</span>
              <span style={{ fontWeight:700,fontSize:11 }}>{prefix}</span>
              {line.nodeId && <span style={{ color:'#007acc',fontSize:11 }}>{line.nodeId}</span>}
              <span style={{ flex:1 }}>{line.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
