import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui-store';
import { useActivityStore } from '@/stores/activity-store';

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

      // Catch-all for unnamed events — safety net only
      es.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ['brain'] });
      };

      // Brain/archived mutations
      const onBrainEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['brain'] });
        queryClient.invalidateQueries({ queryKey: ['archived'] });
      };
      for (const name of ['add', 'remove', 'update', 'confidence', 'archive', 'unarchive', 'annotate', 'retag']) {
        es.addEventListener(name, onBrainEvent);
      }

      // Project events also affect brain data
      const onProjectEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['brain'] });
      };
      for (const name of ['project', 'project-closed', 'project-reopened']) {
        es.addEventListener(name, onProjectEvent);
      }

      // Mission events
      const onMissionEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['missions'] });
      };
      for (const name of ['mission-created', 'mission-updated', 'task-updated']) {
        es.addEventListener(name, onMissionEvent);
      }

      // Push task-updated events into the activity feed
      es.addEventListener('task-updated', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.task) {
            useActivityStore.getState().addEvent({
              id: `${parsed.missionId}-${parsed.task.id}-${Date.now()}`,
              missionId: parsed.missionId,
              missionName: parsed.missionName || parsed.missionId,
              taskId: parsed.task.id,
              taskDescription: parsed.task.description,
              agent: parsed.task.assignedAgent || null,
              status: parsed.task.status || 'unknown',
              timestamp: parsed.ts,
            });
          }
        } catch {
          // Ignore malformed events.
        }
      });

      // Session events
      const onSessionEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['sessions'] });
      };
      for (const name of ['session:start', 'session:end']) {
        es.addEventListener(name, onSessionEvent);
      }

      // Profile events
      const onProfileEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
      };
      es.addEventListener('profile-updated', onProfileEvent);

      // Audit events
      const onAuditEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['audit-reports'] });
      };
      es.addEventListener('brain-audit', onAuditEvent);

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
