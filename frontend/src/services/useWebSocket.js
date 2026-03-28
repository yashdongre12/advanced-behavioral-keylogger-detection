// services/useWebSocket.js
// ─────────────────────────────────────────────────────────────────────────────
// Custom React hook that wraps a WebSocket connection to the backend.
// Reconnects automatically on disconnect.
// Usage:
//   const { data, connected } = useWebSocket('ws://localhost:8000/ws/live');
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';

const RECONNECT_DELAY_MS = 3000;

export default function useWebSocket(url) {
  const [data, setData]           = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState(null);
  const wsRef                     = useRef(null);
  const mountedRef                = useRef(true);
  const retryTimer                = useRef(null);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data);
          setData(parsed);
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e);
        }
      };

      ws.onerror = (e) => {
        if (!mountedRef.current) return;
        setError('WebSocket connection error');
        setConnected(false);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        // Auto-reconnect after delay
        retryTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

    } catch (e) {
      setError(`Failed to create WebSocket: ${e.message}`);
      retryTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;  // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, []);

  return { data, connected, error, send };
}
