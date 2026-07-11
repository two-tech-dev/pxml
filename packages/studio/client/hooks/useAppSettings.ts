import { useState, useEffect } from 'react';

export interface AppSettings {
  fontSize: number;
  fontFamily: string;
  minimap: boolean;
  smoothScroll: boolean;
  lineNumbers: boolean;
  accentColor: string;
  panelPosition: 'left' | 'right' | 'bottom';
  activityBarVisible: boolean;
  statusBarVisible: boolean;
  tabSize: number;
  wordWrap: 'off' | 'on';
  formatOnSave: boolean;
  autoSave: boolean;
  outputMaxLines: number;
  timestampsVisible: boolean;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  snapToGrid: boolean;
  showEdgeLabels: boolean;
  nodeMinimap: boolean;
}

const DEFAULTS: AppSettings = {
  fontSize: 13, fontFamily: "'Inter', sans-serif", minimap: true, smoothScroll: true,
  lineNumbers: true, accentColor: '#3b82f6', panelPosition: 'right',
  activityBarVisible: true, statusBarVisible: true, tabSize: 2, wordWrap: 'off',
  formatOnSave: false, autoSave: true, outputMaxLines: 500, timestampsVisible: true,
  provider: 'anthropic', model: 'claude-3-5-sonnet', apiKey: '', baseUrl: '',
  snapToGrid: false, showEdgeLabels: true, nodeMinimap: true,
};

export function useAppSettings(): AppSettings {
  const [s, setS] = useState<AppSettings>(DEFAULTS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pxml-studio-settings');
      if (raw) setS({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  return s;
}
