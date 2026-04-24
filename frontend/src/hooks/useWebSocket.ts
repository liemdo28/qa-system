import { useEffect, useRef, useCallback } from 'react';
import { WSMessage } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export function useWebSocket(onMessage: (msg: WSMessage) => void): void {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        onMessageRef.current(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      // Reconnect after 3s if connection drops
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
