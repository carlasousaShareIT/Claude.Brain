import { Button } from '@/components/ui/button';
import { SECTION_LABELS } from '@/lib/constants';
import type { ConflictResult } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

interface ConflictWarningProps {
  conflicts: ConflictResult[];
  onAddAnyway: () => void;
  onCancel: () => void;
}

export function ConflictWarning({ conflicts, onAddAnyway, onCancel }: ConflictWarningProps) {
  return (
    <div className="rounded-md border border-brain-amber/30 bg-brain-amber/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-brain-amber">
        <AlertTriangle className="size-3.5" />
        <span className="text-xs font-medium">Conflicts detected</span>
      </div>

      {conflicts.map((c, i) => (
        <div key={i} className="space-y-1">
          <p className="text-xs text-foreground">{c.text}</p>
          <p className="text-[10px] text-muted-foreground">
            <span className="text-brain-amber">{SECTION_LABELS[c.section] ?? c.section}</span>
            {' \u2014 '}
            {c.reason}
          </p>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="xs"
          className="text-brain-amber hover:bg-brain-amber/10"
          onClick={onAddAnyway}
        >
          Add anyway
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
