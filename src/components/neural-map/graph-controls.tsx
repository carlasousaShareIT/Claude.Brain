import { useEffect, useState } from 'react';
import type { Brain } from '@/lib/types';
import { useUIStore } from '@/stores/ui-store';
import { api } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GraphControlsProps {
  nodeCount: number;
  edgeCount: number;
  brain: Brain | undefined;
}

export function GraphControls({ nodeCount, edgeCount, brain }: GraphControlsProps) {
  const graphProjectFilterId = useUIStore((s) => s.graphProjectFilterId);
  const setGraphProjectFilterId = useUIStore((s) => s.setGraphProjectFilterId);
  const sessionFilterId = useUIStore((s) => s.sessionFilterId);
  const setSessionFilterId = useUIStore((s) => s.setSessionFilterId);

  const [sessions, setSessions] = useState<{ id: string; count: number }[]>([]);

  // Fetch sessions list.
  useEffect(() => {
    api.getSessions()
      .then((data: unknown) => {
        const arr = Array.isArray(data) ? data : [];
        setSessions(arr.map((s: { id: string; count: number }) => ({ id: s.id, count: s.count })));
      })
      .catch(() => {});
  }, []);

  const projects = brain?.projects ?? [];

  return (
    <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
      {/* Stats. */}
      <div className="rounded-lg border border-white/5 bg-brain-raised/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
        {nodeCount} nodes · {edgeCount} links
      </div>

      {/* Project filter. */}
      <Select
        value={graphProjectFilterId || 'all'}
        onValueChange={(v) => setGraphProjectFilterId(v === 'all' ? '' : v)}
      >
        <SelectTrigger size="sm" className="w-40 border-white/10 bg-brain-raised/80 text-xs backdrop-blur-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Session filter. */}
      <Select
        value={sessionFilterId || 'all'}
        onValueChange={(v) => setSessionFilterId(v === 'all' ? '' : v)}
      >
        <SelectTrigger size="sm" className="w-40 border-white/10 bg-brain-raised/80 text-xs backdrop-blur-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sessions</SelectItem>
          {sessions.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.id.slice(0, 8)}... ({s.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
