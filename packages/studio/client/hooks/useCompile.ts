import { useCallback } from 'react';
import { useProjectStore, useOutputStore } from '../stores/index.js';
import type { ProviderSettings } from '../components/dialogs/ProviderSettingsDialog.js';

export function useCompile(settings: ProviderSettings) {
  const workspacePath = useProjectStore(s => s.workspacePath);
  const append = useOutputStore(s => s.append);
  const setCompiling = useOutputStore(s => s.setCompiling);
  const setCostSummary = useOutputStore(s => s.setCostSummary);
  const setNodeStatus = useProjectStore(s => s.setNodeStatus);
  const clearNodeStatuses = useProjectStore(s => s.clearNodeStatuses);

  const handleWsMessage = useCallback((msg: any) => {
    const ch = msg.channel || (msg.type?.startsWith('compile') ? 'compile' : msg.type?.startsWith('fix') ? 'fix' : msg.type?.startsWith('test') ? 'test' : 'general');
    switch (msg.type) {
      case 'compile:resume':
        setCompiling(true);
        append({ type: 'warn', message: msg.message || 'Compilation in progress...', channel: 'compile' });
        break;

      case 'compile:start':
        setCompiling(true);
        clearNodeStatuses();
        append({ type: 'info', message: msg.message || 'Compilation started', channel: 'compile' });
        break;

      case 'compile:validating':
        append({ type: 'info', message: msg.message, channel: 'compile' });
        break;

      case 'compile:validated':
        append({ type: 'success', message: msg.message, channel: 'compile' });
        break;

      case 'compile:node:start':
        if (msg.nodeId) setNodeStatus(msg.nodeId, 'compiling');
        append({ type: 'info', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'compile' });
        break;

      case 'compile:node:skip':
        if (msg.nodeId) setNodeStatus(msg.nodeId, 'done');
        append({ type: 'warn', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'compile' });
        break;

      case 'compile:node:done':
        if (msg.nodeId) setNodeStatus(msg.nodeId, 'done');
        append({ type: 'success', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'compile' });
        break;

      case 'compile:node:error':
        if (msg.nodeId) setNodeStatus(msg.nodeId, 'error');
        append({ type: 'error', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'compile' });
        break;

      case 'compile:testgen:start':
        append({ type: 'info', message: msg.message, channel: 'test' });
        break;

      case 'compile:testgen:done':
        append({ type: 'success', message: msg.message, channel: 'test' });
        break;

      case 'compile:test:start':
        append({ type: 'info', message: msg.message, channel: 'test' });
        break;

      case 'compile:test:result':
        append({
          type: msg.passed ? 'success' : 'error',
          message: `[${msg.nodeId}] ${msg.message}`,
          nodeId: msg.nodeId, channel: 'test',
        });
        break;

      case 'compile:fix:start':
        append({ type: 'warn', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'fix' });
        break;

      case 'compile:fix:attempt':
        append({ type: 'warn', message: `[${msg.nodeId}] Fix attempt ${msg.attempt}/3`, nodeId: msg.nodeId, channel: 'fix' });
        break;

      case 'compile:fix:done':
        setNodeStatus(msg.nodeId, 'done');
        append({ type: 'success', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'fix' });
        break;

      case 'compile:build:check':
        append({ type: 'info', message: msg.message, channel: 'compile' });
        break;

      case 'compile:build:result':
        append({ type: msg.passed ? 'success' : 'error', message: msg.message, channel: 'compile' });
        break;

      case 'compile:done':
        setCompiling(false);
        setCostSummary({
          inputTokens: msg.inputTokens || 0,
          outputTokens: msg.outputTokens || 0,
          cachedTokens: msg.cachedTokens || 0,
        });
        append({ type: msg.error ? 'error' : 'success', message: msg.message || 'Compilation complete.', channel: 'compile' });
        break;

      case 'compile:error':
        setCompiling(false);
        append({ type: 'error', message: msg.message, channel: 'compile' });
        break;

      case 'test:result':
        append({ type: msg.passed ? 'success' : 'error', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'test' });
        break;

      case 'fix:start':
        if (msg.nodeId) setNodeStatus(msg.nodeId, 'compiling');
        append({ type: 'warn', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'fix' });
        break;

      case 'fix:attempt':
        append({ type: 'warn', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'fix' });
        break;

      case 'fix:done':
        if (msg.nodeId) setNodeStatus(msg.nodeId, 'done');
        append({ type: 'success', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'fix' });
        break;

      case 'fix:error':
        if (msg.nodeId) setNodeStatus(msg.nodeId, 'error');
        append({ type: 'error', message: `[${msg.nodeId || 'fix'}] ${msg.message}`, nodeId: msg.nodeId, channel: 'fix' });
        break;

      case 'autotest:start':
        append({ type: 'info', message: msg.message, channel: 'test' });
        break;
      case 'autotest:progress':
        append({ type: 'info', message: msg.message, channel: 'test' });
        break;
      case 'autotest:node:start':
        append({ type: 'info', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'test' });
        break;
      case 'autotest:node:done':
        append({ type: 'success', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'test' });
        break;
      case 'autotest:node:error':
        append({ type: 'error', message: `[${msg.nodeId}] ${msg.message}`, nodeId: msg.nodeId, channel: 'test' });
        break;
      case 'autotest:done':
        append({ type: msg.passed === msg.total ? 'success' : 'warn', message: `Auto-test complete: ${msg.message}`, channel: 'test' });
        break;
      case 'autotest:error':
        append({ type: 'error', message: `Auto-test error: ${msg.message}`, channel: 'test' });
        break;

      case 'console:start':
        append({ type: 'info', message: `$ ${msg.command}`, channel: 'plugin' });
        break;

      case 'console:data':
        append({ type: 'info', message: msg.data.replace(/\n$/, ''), channel: 'plugin' });
        break;

      case 'console:done':
        if (msg.exitCode !== 0) {
          append({ type: 'error', message: `Command exited with code ${msg.exitCode}`, channel: 'plugin' });
        }
        break;
    }
  }, [append, setCompiling, setCostSummary, setNodeStatus, clearNodeStatuses]);

  const compile = useCallback(async (options?: {
    dryRun?: boolean;
    verify?: boolean;
    autogenTests?: boolean;
    validate?: boolean;
    buildCheck?: boolean;
  }) => {
    if (!workspacePath) {
      append({ type: 'error', message: 'No project open.' });
      return;
    }

    setCompiling(true);
    append({ type: 'info', message: `Starting compile: ${settings.provider} / ${settings.model}` });

    try {
      await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: workspacePath,
          provider: settings.provider,
          model: settings.model || undefined,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          ...options,
        }),
      });
    } catch (e: any) {
      append({ type: 'error', message: `Request failed: ${e.message}` });
      setCompiling(false);
    }
  }, [workspacePath, settings, append, setCompiling]);

  return { compile, handleWsMessage };
}
