import { useState, useEffect, useRef } from 'react';
import { useProjectStore, useUIStore } from '../../stores/index.js';
import { Settings, Palette, Code2, Terminal, Zap, Network, X } from 'lucide-react';

interface SettingsState {
  // General
  fontSize: number;
  fontFamily: string;
  minimap: boolean;
  smoothScroll: boolean;
  lineNumbers: boolean;

  // Appearance
  accentColor: string;
  panelPosition: 'left' | 'right' | 'bottom';
  activityBarVisible: boolean;
  statusBarVisible: boolean;

  // Editor
  tabSize: number;
  wordWrap: 'off' | 'on';
  formatOnSave: boolean;
  autoSave: boolean;

  // Output
  outputMaxLines: number;
  timestampsVisible: boolean;

  // Provider
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;

  // Graph
  snapToGrid: boolean;
  showEdgeLabels: boolean;
  nodeMinimap: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  fontSize: 13, fontFamily: "'Inter', sans-serif", minimap: true, smoothScroll: true,
  lineNumbers: true, accentColor: '#3b82f6', panelPosition: 'right',
  activityBarVisible: true, statusBarVisible: true, tabSize: 2, wordWrap: 'off',
  formatOnSave: false, autoSave: true, outputMaxLines: 500, timestampsVisible: true,
  provider: 'anthropic', model: 'claude-3-5-sonnet', apiKey: '', baseUrl: '',
  snapToGrid: false, showEdgeLabels: true, nodeMinimap: true,
};

const STORAGE_KEY = 'pxml-studio-settings';

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: SettingsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

type SettingSection = 'general' | 'appearance' | 'editor' | 'output' | 'provider' | 'graph';

const SECTIONS: { key: SettingSection; label: string; Icon: any }[] = [
  { key: 'general', label: 'General', Icon: Settings },
  { key: 'appearance', label: 'Appearance', Icon: Palette },
  { key: 'editor', label: 'Editor', Icon: Code2 },
  { key: 'output', label: 'Output', Icon: Terminal },
  { key: 'provider', label: 'AI Provider', Icon: Zap },
  { key: 'graph', label: 'Graph', Icon: Network },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [activeSection, setActiveSection] = useState<SettingSection>('general');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setSettings(loadSettings()); setTimeout(() => searchRef.current?.focus(), 100); } }, [open]);

  const update = (patch: Partial<SettingsState>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  if (!open) return null;

  const modifiedSections = new Set<SettingSection>();
  for (const [k, v] of Object.entries(settings)) {
    if (v !== (DEFAULT_SETTINGS as any)[k]) {
      if (['fontSize','fontFamily','autoSave'].includes(k)) modifiedSections.add('general');
      else if (['accentColor','activityBarVisible','statusBarVisible','panelPosition'].includes(k)) modifiedSections.add('appearance');
      else if (['tabSize','wordWrap','formatOnSave','smoothScroll'].includes(k)) modifiedSections.add('editor');
      else if (['outputMaxLines','timestampsVisible'].includes(k)) modifiedSections.add('output');
      else if (['provider','model','apiKey','baseUrl'].includes(k)) modifiedSections.add('provider');
      else if (['snapToGrid','showEdgeLabels','nodeMinimap','minimap'].includes(k)) modifiedSections.add('graph');
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#0a0a0a', animation: 'fadeIn 0.15s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '10px 20px',
          borderBottom: '1px solid #1f1f1f', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e5e5e5' }}>Settings</span>
          <div style={{ flex: 1 }} />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search settings..."
            style={{ width: 240, padding: '5px 10px', fontSize: 12 }}
          />
          <button onClick={onClose} style={{
            color: '#737373', fontSize: 18, padding: '4px 8px', borderRadius: 4,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e5e5e5'; e.currentTarget.style.background = '#171717'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#737373'; e.currentTarget.style.background = 'transparent'; }}
          ><X size={16} /></button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{
            width: 200, borderRight: '1px solid #1f1f1f', padding: '8px 0',
            overflowY: 'auto', flexShrink: 0, background: '#111111',
          }}>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 16px', fontSize: 12, textAlign: 'left',
                color: activeSection === s.key ? '#e5e5e5' : '#a3a3a3',
                background: activeSection === s.key ? '#1c1c1c' : 'transparent',
                borderLeft: activeSection === s.key ? '2px solid #e5e5e5' : '2px solid transparent',
                borderRadius: 0,
              }}
                onMouseEnter={e => { if (activeSection !== s.key) e.currentTarget.style.background = '#171717'; }}
                onMouseLeave={e => { if (activeSection !== s.key) e.currentTarget.style.background = 'transparent'; }}
              >
                <s.Icon size={14} strokeWidth={1.5} style={{ width: 18, textAlign: 'center' }} />
                <span style={{ flex: 1 }}>{s.label}</span>
                {modifiedSections.has(s.key) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5e5e5', flexShrink: 0 }} title="Modified" />}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {activeSection === 'general' && <GeneralSection settings={settings} update={update} search={search} />}
            {activeSection === 'appearance' && <AppearanceSection settings={settings} update={update} search={search} />}
            {activeSection === 'editor' && <EditorSection settings={settings} update={update} search={search} />}
            {activeSection === 'output' && <OutputSection settings={settings} update={update} search={search} />}
            {activeSection === 'provider' && <ProviderSection settings={settings} update={update} search={search} />}
            {activeSection === 'graph' && <GraphSection settings={settings} update={update} search={search} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Reusable components ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e5e5', marginBottom: 16 }}>{children}</div>;
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderBottom: '1px solid #171717',
    }}>
      <div style={{ flex: 1, marginRight: 24 }}>
        <div style={{ fontSize: 12, color: '#e5e5e5', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: '#525252', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 10, padding: 2,
      background: value ? '#e5e5e5' : '#262626',
      transition: 'background 0.15s', position: 'relative',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: value ? '#0a0a0a' : '#525252',
        transition: 'all 0.15s', transform: value ? 'translateX(16px)' : 'translateX(0)',
      }} />
    </button>
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: '4px 8px', fontSize: 12, minWidth: 120, cursor: 'pointer',
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
      min={min} max={max} style={{ width: 60, padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
    />
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={{ width: 220, padding: '4px 8px', fontSize: 12 }}
    />
  );
}

function filterBySearch(label: string, description: string, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return label.toLowerCase().includes(q) || description.toLowerCase().includes(q);
}

// --- Sections ---

function GeneralSection({ settings: s, update, search }: { settings: SettingsState; update: (p: Partial<SettingsState>) => void; search: string }) {
  return (
    <div>
      <SectionTitle>General</SectionTitle>
      {filterBySearch('Font Size', 'editor font size', search) && (
        <SettingRow label="Font Size" description="Controls the font size in pixels">
          <NumberInput value={s.fontSize} onChange={v => update({ fontSize: v })} min={8} max={32} />
        </SettingRow>
      )}
      {filterBySearch('Font Family', 'editor font family', search) && (
        <SettingRow label="Font Family" description="Controls the font family">
          <TextInput value={s.fontFamily} onChange={v => update({ fontFamily: v })} />
        </SettingRow>
      )}
      {filterBySearch('Auto Save', 'automatically save files', search) && (
        <SettingRow label="Auto Save" description="Auto save files after changes">
          <Toggle value={s.autoSave} onChange={v => update({ autoSave: v })} />
        </SettingRow>
      )}
      {filterBySearch('Format On Save', 'format code on save', search) && (
        <SettingRow label="Format On Save" description="Format code automatically on save">
          <Toggle value={s.formatOnSave} onChange={v => update({ formatOnSave: v })} />
        </SettingRow>
      )}
    </div>
  );
}

function AppearanceSection({ settings: s, update, search }: { settings: SettingsState; update: (p: Partial<SettingsState>) => void; search: string }) {
  return (
    <div>
      <SectionTitle>Appearance</SectionTitle>
      {filterBySearch('Accent Color', 'UI accent color', search) && (
        <SettingRow label="Accent Color" description="Controls the accent color used for focus and active states">
          <div style={{ display: 'flex', gap: 6 }}>
            {['#3b82f6','#22c55e','#ef4444','#eab308','#a855f7','#ec4899','#737373'].map(c => (
              <button key={c} onClick={() => update({ accentColor: c })} style={{
                width: 20, height: 20, borderRadius: '50%', background: c,
                border: s.accentColor === c ? '2px solid #e5e5e5' : '2px solid transparent',
                outline: s.accentColor === c ? '2px solid ' + c : 'none',
                outlineOffset: 2,
              }} />
            ))}
          </div>
        </SettingRow>
      )}
      {filterBySearch('Activity Bar', 'show activity bar', search) && (
        <SettingRow label="Activity Bar" description="Show or hide the activity bar">
          <Toggle value={s.activityBarVisible} onChange={v => update({ activityBarVisible: v })} />
        </SettingRow>
      )}
      {filterBySearch('Status Bar', 'show status bar', search) && (
        <SettingRow label="Status Bar" description="Show or hide the status bar">
          <Toggle value={s.statusBarVisible} onChange={v => update({ statusBarVisible: v })} />
        </SettingRow>
      )}
      {filterBySearch('Panel Position', 'panel position', search) && (
        <SettingRow label="Panel Position" description="Position of the bottom panel">
          <SelectInput value={s.panelPosition} onChange={v => update({ panelPosition: v as any })}
            options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }, { value: 'bottom', label: 'Bottom' }]}
          />
        </SettingRow>
      )}
    </div>
  );
}

function EditorSection({ settings: s, update, search }: { settings: SettingsState; update: (p: Partial<SettingsState>) => void; search: string }) {
  return (
    <div>
      <SectionTitle>Editor</SectionTitle>
      {filterBySearch('Tab Size', 'tab size in spaces', search) && (
        <SettingRow label="Tab Size" description="The number of spaces a tab is equal to">
          <NumberInput value={s.tabSize} onChange={v => update({ tabSize: v })} min={1} max={8} />
        </SettingRow>
      )}
      {filterBySearch('Word Wrap', 'word wrap mode', search) && (
        <SettingRow label="Word Wrap" description="Controls how lines should wrap">
          <SelectInput value={s.wordWrap} onChange={v => update({ wordWrap: v as any })}
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
          />
        </SettingRow>
      )}
      {filterBySearch('Smooth Scrolling', 'smooth scrolling', search) && (
        <SettingRow label="Smooth Scrolling" description="Enable smooth scrolling animation">
          <Toggle value={s.smoothScroll} onChange={v => update({ smoothScroll: v })} />
        </SettingRow>
      )}
    </div>
  );
}

function OutputSection({ settings: s, update, search }: { settings: SettingsState; update: (p: Partial<SettingsState>) => void; search: string }) {
  return (
    <div>
      <SectionTitle>Output</SectionTitle>
      {filterBySearch('Max Lines', 'maximum output lines', search) && (
        <SettingRow label="Max Lines" description="Maximum number of lines kept in output">
          <NumberInput value={s.outputMaxLines} onChange={v => update({ outputMaxLines: v })} min={100} max={5000} />
        </SettingRow>
      )}
      {filterBySearch('Show Timestamps', 'show timestamps in output', search) && (
        <SettingRow label="Show Timestamps" description="Display timestamps for output lines">
          <Toggle value={s.timestampsVisible} onChange={v => update({ timestampsVisible: v })} />
        </SettingRow>
      )}
    </div>
  );
}

function ProviderSection({ settings: s, update, search }: { settings: SettingsState; update: (p: Partial<SettingsState>) => void; search: string }) {
  return (
    <div>
      <SectionTitle>AI Provider</SectionTitle>
      {filterBySearch('Provider', 'AI provider', search) && (
        <SettingRow label="Provider" description="Select your AI provider">
          <SelectInput value={s.provider} onChange={v => update({ provider: v })}
            options={[
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'openai', label: 'OpenAI' },
              { value: 'ollama', label: 'Ollama (Local)' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </SettingRow>
      )}
      {filterBySearch('Model', 'AI model name', search) && (
        <SettingRow label="Model" description="The model to use for AI operations">
          <TextInput value={s.model} onChange={v => update({ model: v })} placeholder="e.g. claude-3-5-sonnet" />
        </SettingRow>
      )}
      {filterBySearch('API Key', 'API key for the provider', search) && (
        <SettingRow label="API Key" description="Your API key (stored in localStorage)">
          <TextInput value={s.apiKey} onChange={v => update({ apiKey: v })} type="password" placeholder="sk-..." />
        </SettingRow>
      )}
      {filterBySearch('Base URL', 'API base URL', search) && (
        <SettingRow label="Base URL" description="Base URL for API requests">
          <TextInput value={s.baseUrl} onChange={v => update({ baseUrl: v })} placeholder="https://api.example.com/v1" />
        </SettingRow>
      )}
    </div>
  );
}

function GraphSection({ settings: s, update, search }: { settings: SettingsState; update: (p: Partial<SettingsState>) => void; search: string }) {
  return (
    <div>
      <SectionTitle>Graph</SectionTitle>
      {filterBySearch('Snap to Grid', 'snap nodes to grid', search) && (
        <SettingRow label="Snap to Grid" description="Snap node positions to grid when dragging">
          <Toggle value={s.snapToGrid} onChange={v => update({ snapToGrid: v })} />
        </SettingRow>
      )}
      {filterBySearch('Show Edge Labels', 'show labels on edges', search) && (
        <SettingRow label="Show Edge Labels" description="Display labels on connection edges">
          <Toggle value={s.showEdgeLabels} onChange={v => update({ showEdgeLabels: v })} />
        </SettingRow>
      )}
      {filterBySearch('Mini Map', 'show minimap', search) && (
        <SettingRow label="Mini Map" description="Show the minimap in the graph canvas">
          <Toggle value={s.nodeMinimap} onChange={v => update({ nodeMinimap: v })} />
        </SettingRow>
      )}
    </div>
  );
}
