import { cn } from '@/lib/utils';
import type { ChatMessage, SearchResult } from '@/lib/types';
import { ResultCard } from './result-card';
import { ConflictWarning } from './conflict-warning';

interface ChatBubbleProps {
  message: ChatMessage;
  onArchiveResult?: (result: SearchResult) => void;
  onToggleConfidence?: (result: SearchResult) => void;
  onConflictAddAnyway?: () => void;
  onConflictCancel?: () => void;
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1 py-1">
      <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

export function ChatBubble({
  message,
  onArchiveResult,
  onToggleConfidence,
  onConflictAddAnyway,
  onConflictCancel,
}: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-lg px-3 py-2',
          isUser ? 'bg-brain-accent/20 text-foreground' : 'bg-brain-surface text-foreground'
        )}
      >
        {message.type === 'thinking' && <ThinkingDots />}

        {message.type === 'text' && (
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}

        {(!message.type || message.type === 'text') && !message.content && null}

        {message.type === 'search-results' && (
          <div className="space-y-2">
            {message.content && (
              <p className="text-xs text-muted-foreground mb-2">{message.content}</p>
            )}
            {message.data?.map((result, i) => (
              <ResultCard
                key={i}
                result={result}
                onArchive={onArchiveResult}
                onToggleConfidence={onToggleConfidence}
              />
            ))}
          </div>
        )}

        {message.type === 'conflict' && (
          <ConflictWarning
            conflicts={message.data}
            onAddAnyway={onConflictAddAnyway ?? (() => {})}
            onCancel={onConflictCancel ?? (() => {})}
          />
        )}

        {message.type === 'batch' && (
          <div className="space-y-1">
            {message.data?.map((line, i) => (
              <p key={i} className="text-xs text-foreground leading-relaxed">{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
