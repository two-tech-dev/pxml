import { useState, useEffect } from 'react';

export interface ProviderSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

const PRESETS: Record<string, { model: string; baseUrl: string }> = {
  anthropic: { model: 'claude-3-5-sonnet',         baseUrl: '' },
  openai:    { model: 'gpt-4o',                     baseUrl: 'https://api.openai.com/v1' },
  ollama:    { model: 'llama3.2:latest',            baseUrl: 'http://localhost:11434' },
  custom:    { model: '',                           baseUrl: 'http://localhost:8080/v1' },
};

const MODELS: Record<string, string[]> = {
  anthropic: ['claude-3-5-sonnet','claude-3-7-sonnet','claude-3-opus','claude-3-haiku','claude-sonnet-4','claude-opus-4'],
  openai:    ['gpt-4o','gpt-4-turbo','gpt-4o-mini','o3-mini','o1','o1-mini','gpt-3.5-turbo'],
  ollama:    ['llama3.2:latest','codellama:latest','mistral:latest','deepseek-r1:latest','qwen2.5-coder:latest'],
  custom:    [],
};

const STORAGE_KEY = 'pxml-provider-settings';

function loadSettings(): ProviderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { provider: 'anthropic', model: 'claude-3-5-sonnet', apiKey: '', baseUrl: '' };
}

function saveSettings(s: ProviderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function getPersistedSettings(): ProviderSettings {
  return loadSettings();
}

const inputS: React.CSSProperties = {
  width: '100%', padding: '6px 10px', fontSize: 12,
  background: '#1e1e1e', border: '1px solid #3e3e42', borderRadius: 4,
  color: '#cccccc', outline: 'none',
};
const labelS: React.CSSProperties = { fontSize: 11, color: '#999999', marginBottom: 3, fontWeight: 500 };

export function ProviderSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [s, setS] = useState<ProviderSettings>(loadSettings);

  useEffect(() => { if (open) setS(loadSettings()); }, [open]);

  const apply = (next: ProviderSettings) => {
    setS(next);
    saveSettings(next);
  };

  const setP = (provider: string) => {
    const preset = PRESETS[provider] || PRESETS.custom;
    apply({ provider, model: preset.model, apiKey: s.apiKey, baseUrl: preset.baseUrl });
  };

  if (!open) return null;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#252526', border:'1px solid #3e3e42', borderRadius:10, padding:24, width:440, boxShadow:'0 16px 48px rgba(0,0,0,0.5)' }}>
        <h3 style={{ margin:'0 0 16px', fontSize:17, fontWeight:700, color:'#cccccc' }}>Provider Settings</h3>

        <div style={labelS}>Provider</div>
        <select value={s.provider} onChange={e => setP(e.target.value)}
          style={{...inputS, marginBottom:12, cursor:'pointer'}}>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI / Compatible</option>
          <option value="ollama">Ollama (Local)</option>
          <option value="custom">Custom API</option>
        </select>

        <div style={labelS}>API Key</div>
        <input
          type="password"
          value={s.apiKey}
          onChange={e => apply({ ...s, apiKey: e.target.value })}
          placeholder={s.provider === 'ollama' ? 'Not required for Ollama' : `Required (or env var ${s.provider === 'openai' ? 'OPENAI_API_KEY' : s.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : ''})`}
          style={{...inputS, marginBottom:12}}
        />

        <div style={labelS}>Base URL</div>
        <input
          value={s.baseUrl}
          onChange={e => apply({ ...s, baseUrl: e.target.value })}
          placeholder={PRESETS[s.provider]?.baseUrl || 'https://api.example.com/v1'}
          style={{...inputS, marginBottom:12}}
        />

        <div style={labelS}>Model</div>
        <input
          value={s.model}
          onChange={e => apply({ ...s, model: e.target.value })}
          placeholder="e.g. gpt-4o, llama3.2:latest"
          list="provider-model-list"
          style={{...inputS, marginBottom:16}}
        />
        <datalist id="provider-model-list">
          {(MODELS[s.provider] || MODELS.custom).map(m => <option key={m} value={m} />)}
        </datalist>

        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <button
            onClick={() => { const p = PRESETS[s.provider]; apply({ ...s, model: p.model, baseUrl: p.baseUrl }); }}
            style={{ ...buttonS, background:'#3e3e42' }}
          >Reset defaults for {s.provider}</button>
        </div>

        <div style={{ fontSize:10, color:'#666666', marginBottom:16, lineHeight:1.5 }}>
          API keys are stored in browser localStorage. For production, set environment variables: <code style={{color:'#999999',background:'#1e1e1e',padding:'1px 4px',borderRadius:2}}>ANTHROPIC_API_KEY</code>, <code style={{color:'#999999',background:'#1e1e1e',padding:'1px 4px',borderRadius:2}}>OPENAI_API_KEY</code>.
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} style={{ ...buttonS, background:'#3e3e42' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

const buttonS: React.CSSProperties = {
  padding: '6px 16px', fontSize: 12, fontWeight: 500, borderRadius: 6,
  color: '#cccccc', border: '1px solid #3e3e42', cursor: 'pointer',
};
