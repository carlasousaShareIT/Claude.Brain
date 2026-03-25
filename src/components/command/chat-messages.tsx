import { useRef, useEffect } from 'react';
import type { ChatMessage, SearchResult } from '@/lib/types';
import { ChatBubble } from './chat-bubble';
import { Suggestions } from './suggestions';

interface ChatMessagesProps {
  messages: ChatMessage[];
  onSuggestionSelect: (text: string) => void;
  onArchiveResult?: (result: SearchResult) => void;
  onToggleConfidence?: (result: SearchResult) => void;
  onConflictAddAnyway?: () => void;
  onConflictCancel?: () => void;
}

export function ChatMessages({
  messages,
  onSuggestionSelect,
  onArchiveResult,
  onToggleConfidence,
  onConflictAddAnyway,
  onConflictCancel,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Suggestions onSelect={onSuggestionSelect} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-2.5 p-3">
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            onArchiveResult={onArchiveResult}
            onToggleConfidence={onToggleConfidence}
            onConflictAddAnyway={onConflictAddAnyway}
            onConflictCancel={onConflictCancel}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
