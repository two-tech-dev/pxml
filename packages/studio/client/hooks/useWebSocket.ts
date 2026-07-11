import { useEffect, useRef } from 'react';

interface WsMessage {
  type: string;
  message?: string;
  nodeId?: string;
  passed?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  attempt?: number;
  output?: string;
  [key: string]: any;
}

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number>(0);
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  useEffect(() => {
    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.hostname}:3001/ws`);

      ws.onopen = () => {
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMsgRef.current(data);
        } catch {}
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 3s...');
        wsRef.current = null;
        timerRef.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = (e) => {
        console.warn('[WS] Error', e);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return wsRef;
}
