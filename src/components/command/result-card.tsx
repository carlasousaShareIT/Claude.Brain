import { Button } from '@/components/ui/button';
import { SECTION_COLORS, SECTION_LABELS } from '@/lib/constants';
import { cn, timeAgo, entryText } from '@/lib/utils';
import type { SearchResult } from '@/lib/types';
import { Archive, ShieldCheck, ShieldAlert } from 'lucide-react';

interface ResultCardProps {
  result: SearchResult;
  onArchive?: (result: SearchResult) => void;
  onToggleConfidence?: (result: SearchResult) => void;
}

export function ResultCard({ result, onArchive, onToggleConfidence }: ResultCardProps) {
  const { section, entry } = result;
  const text = entryText(entry);
  const color = SECTION_COLORS[section] ?? '#9d9db5';
  const label = SECTION_LABELS[section] ?? section;
  const isFirm = entry.confidence === 'firm';

  return (
    <div className="rounded-md border border-[#62627a]/20 bg-brain-surface p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span className="ml-auto text-[10px] text-[#62627a]">
          {entry.createdAt ? timeAgo(entry.createdAt) : ''}
        </span>
      </div>

      <p className="text-xs text-foreground leading-relaxed">{text}</p>

      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px]',
            isFirm
              ? 'bg-brain-green/10 text-brain-green'
              : 'bg-brain-amber/10 text-brain-amber'
          )}
        >
          {isFirm ? 'firm' : 'tentative'}
        </span>

        {entry.project.length > 0 && (
          <span className="text-[10px] text-[#62627a]">
            {entry.project.join(', ')}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {onToggleConfidence && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-[#62627a] hover:text-foreground"
              onClick={() => onToggleConfidence(result)}
              title={isFirm ? 'Mark tentative' : 'Mark firm'}
            >
              {isFirm ? <ShieldAlert className="size-3" /> : <ShieldCheck className="size-3" />}
            </Button>
          )}
          {onArchive && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-[#62627a] hover:text-brain-amber"
              onClick={() => onArchive(result)}
              title="Archive"
            >
              <Archive className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
