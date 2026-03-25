import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui-store';

export function useSSE() {
  const queryClient = useQueryClient();
  const setServerLive = useUIStore((s) => s.setServerLive);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (esRef.current) {
        esRef.current.close();
      }

      const es = new EventSource('/memory/stream');
      esRef.current = es;

      es.onopen = () => {
        setServerLive(true);
      };

      es.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ['brain'] });
        queryClient.invalidateQueries({ queryKey: ['missions'] });
        queryClient.invalidateQueries({ queryKey: ['archived'] });
      };

      es.onerror = () => {
        setServerLive(false);
        es.close();
        esRef.current = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [queryClient, setServerLive]);
}
