import { SECTION_COLORS, SECTION_LABELS } from '@/lib/constants';
import { timeAgo, truncate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { GNode } from './use-graph';

interface GraphTooltipProps {
  node: GNode;
  position: { x: number; y: number };
  isPinned: boolean;
  onClose: () => void;
}

export function GraphTooltip({ node, position, isPinned, onClose }: GraphTooltipProps) {
  // Position the tooltip near the cursor but keep it within viewport.
  const left = Math.min(position.x + 12, window.innerWidth - 320);
  const top = Math.min(position.y + 12, window.innerHeight - 300);

  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-lg border border-white/10 bg-brain-raised p-3 shadow-xl"
      style={{
        left,
        top,
        pointerEvents: isPinned ? 'auto' : 'none',
      }}
    >
      {/* Section label. */}
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: SECTION_COLORS[node.section] }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: SECTION_COLORS[node.section] }}
        >
          {SECTION_LABELS[node.section] ?? node.section}
        </span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {node.confidence}
        </Badge>
      </div>

      {/* Entry text. */}
      <p className="mb-2 text-sm leading-snug text-foreground">
        {isPinned ? node.text : truncate(node.text, 160)}
      </p>

      {/* Metadata. */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {node.project.length > 0 && (
          <span>projects: {node.project.join(', ')}</span>
        )}
        {node.sessionId && (
          <span>session: {truncate(node.sessionId, 12)}</span>
        )}
        <span>age: {timeAgo(node.createdAt)}</span>
        <span>touched: {timeAgo(node.lastTouched)}</span>
      </div>

      {/* Pinned-only sections. */}
      {isPinned && (
        <>
          {/* Close button. */}
          <button
            onClick={onClose}
            className="absolute right-2 top-2 text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
