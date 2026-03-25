import { useState, useCallback } from 'react';
import type { SectionName } from '@/lib/types';
import { SECTION_COLORS, SECTION_LABELS } from '@/lib/constants';
import { timeAgo, truncate } from '@/lib/utils';
import { useAnnotations } from '@/hooks/use-annotations';
import { Badge } from '@/components/ui/badge';
import type { GNode } from './use-graph';

interface GraphTooltipProps {
  node: GNode;
  position: { x: number; y: number };
  isPinned: boolean;
  onClose: () => void;
}

export function GraphTooltip({ node, position, isPinned, onClose }: GraphTooltipProps) {
  const { data: annotationsData, annotate } = useAnnotations();
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');

  const annotations = annotationsData?.find(
    (a) => a.text === node.text && a.section === node.section,
  )?.annotations;

  const handleAddNote = useCallback(() => {
    if (!noteText.trim()) return;
    annotate.mutate({
      section: node.section as SectionName,
      text: node.text,
      note: noteText.trim(),
      source: 'brain-app',
    });
    setNoteText('');
    setShowNoteInput(false);
  }, [noteText, annotate, node.section, node.text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleAddNote();
      if (e.key === 'Escape') setShowNoteInput(false);
    },
    [handleAddNote],
  );

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

          {/* Annotations. */}
          {annotations && annotations.length > 0 && (
            <div className="mt-2 border-t border-white/5 pt-2">
              <span className="text-[10px] font-medium text-muted-foreground">Notes</span>
              <ul className="mt-1 space-y-1">
                {annotations.map((a, i) => (
                  <li key={i} className="text-xs text-foreground/80">
                    <span className="text-muted-foreground">{timeAgo(a.ts)}</span>{' '}
                    {a.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Add note. */}
          <div className="mt-2 border-t border-white/5 pt-2">
            {showNoteInput ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a note..."
                  className="flex-1 rounded border border-white/10 bg-brain-base px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-white/20"
                />
                <button
                  onClick={handleAddNote}
                  className="rounded bg-white/10 px-2 py-1 text-xs text-foreground hover:bg-white/15"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNoteInput(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                + Add note
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
