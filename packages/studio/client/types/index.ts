export type NodeType = 'api-route' | 'ui-component' | 'db-model' | 'middleware' | 'config-file' | 'setup-command';

export interface NodeData {
  [key: string]: unknown;
  id: string;
  type: NodeType;
  flow: string;
  extends?: string;
  autogenTests: boolean;
  images: string[];
  meta: {
    path: string;
    depends_on: string[];
  };
  input: { name: string; type: string; required: boolean; format?: string }[];
  output: { name: string; type: string; required: boolean; format?: string }[];
  constraints: { verify: 'static' | 'llm-judge'; description: string; learnedFrom?: string }[];
  tests: { name: string; given: any; expect: any }[];
}

export interface ImportData {
  src?: string;
  package?: string;
  from?: string;
  as: string;
}

export interface ProjectData {
  name: string;
  stack: string;
  version: string;
  autogenTests: boolean;
  imports: ImportData[];
}

export interface XYPosition {
  x: number;
  y: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface LogLine {
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
  nodeId?: string;
}

export const NODE_COLORS: Record<NodeType, { bg: string; border: string; icon: string; label: string }> = {
  'api-route':    { bg: '#064e3b20', border: '#22c55e', icon: '🌐', label: 'API Route' },
  'ui-component':  { bg: '#1e3a5f20', border: '#3b82f6', icon: '⬜', label: 'UI Component' },
  'db-model':     { bg: '#3b076420', border: '#a855f7', icon: '🗄', label: 'DB Model' },
  'middleware':    { bg: '#43140720', border: '#f97316', icon: '🔒', label: 'Middleware' },
  'config-file':   { bg: '#1c191720', border: '#6b7280', icon: '⚙', label: 'Config File' },
  'setup-command': { bg: '#42200620', border: '#eab308', icon: '⚡', label: 'Setup Command' },
};
