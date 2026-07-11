import { useState, useEffect } from 'react';

export interface ProviderSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

const PRESETS: Record<string, { model: string; baseUrl: string }> = {
  anthropic: { model: 'claude-3-5-sonnet', baseUrl: '' },
  openai: { model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' },
  ollama: { model: 'llama3.2:latest', baseUrl: 'http://localhost:11434' },
  custom: { model: '', baseUrl: 'http://localhost:8080/v1' },
};

const MODELS: Record<string, string[]> = {
  anthropic: ['claude-3-5-sonnet','claude-3-7-sonnet','claude-3-opus','claude-3-haiku','claude-sonnet-4','claude-opus-4'],
  openai: ['gpt-4o','gpt-4-turbo','gpt-4o-mini','o3-mini','o1','o1-mini','gpt-3.5-turbo'],
  ollama: ['llama3.2:latest','codellama:latest','mistral:latest','deepseek-r1:latest','qwen2.5-coder:latest'],
  custom: [],
};

const STORAGE_KEY = 'pxml-provider-settings';

function loadSettings(): ProviderSettings {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return { provider: 'anthropic', model: 'claude-3-5-sonnet', apiKey: '', baseUrl: '' };
}

function saveSettings(s: ProviderSettings) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

export function getPersistedSettings(): ProviderSettings { return loadSettings(); }

const inputS: React.CSSProperties = { width: '100%', padding: '6px 10px', fontSize: 12, background: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, color: '#e5e5e5', outline: 'none' };
const labelS: React.CSSProperties = { fontSize: 11, color: '#737373', marginBottom: 4, fontWeight: 500 };

export function ProviderSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [s, setS] = useState<ProviderSettings>(loadSettings);
  useEffect(() => { if (open) setS(loadSettings()); }, [open]);
  const apply = (next: ProviderSettings) => { setS(next); saveSettings(next); };
  const setP = (provider: string) => { const preset = PRESETS[provider] || PRESETS.custom; apply({ provider, model: preset.model, apiKey: s.apiKey, baseUrl: preset.baseUrl }); };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, padding: 24, width: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease-out' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#e5e5e5' }}>Provider Settings</h3>
        <div style={labelS}>Provider</div>
        <select value={s.provider} onChange={e => setP(e.target.value)} style={{...inputS, marginBottom:12, cursor:'pointer'}}>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI / Compatible</option>
          <option value="ollama">Ollama (Local)</option>
          <option value="custom">Custom API</option>
        </select>
        <div style={labelS}>API Key</div>
        <input type="password" value={s.apiKey} onChange={e => apply({ ...s, apiKey: e.target.value })}
          placeholder={s.provider === 'ollama' ? 'Not required' : `Required`} style={{...inputS, marginBottom:12}} />
        <div style={labelS}>Base URL</div>
        <input value={s.baseUrl} onChange={e => apply({ ...s, baseUrl: e.target.value })} placeholder={PRESETS[s.provider]?.baseUrl || 'https://api.example.com/v1'} style={{...inputS, marginBottom:12}} />
        <div style={labelS}>Model</div>
        <input value={s.model} onChange={e => apply({ ...s, model: e.target.value })} placeholder="e.g. gpt-4o" list="provider-model-list" style={{...inputS, marginBottom:16}} />
        <datalist id="provider-model-list">{(MODELS[s.provider] || MODELS.custom).map(m => <option key={m} value={m} />)}</datalist>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, fontWeight: 500, borderRadius: 4, color: '#a3a3a3', border: '1px solid #262626', background: '#171717' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
