import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CheatSheet } from './cheat-sheet';
import { HelpCircle, ArrowUp } from 'lucide-react';

interface CommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function CommandInput({ value, onChange, onSend }: CommandInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim()) {
          onSend();
        }
      }
    },
    [value, onSend]
  );

  const handleCheatSelect = useCallback(
    (cmd: string) => {
      onChange(cmd);
      // Focus textarea after inserting
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [onChange]
  );

  return (
    <div className="border-t border-[#62627a]/20 px-3 py-2.5">
      <div className="flex items-end gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-[#62627a] hover:text-foreground flex-shrink-0 mb-0.5"
                title="Command reference"
              >
                <HelpCircle className="size-3.5" />
              </Button>
            }
          />
          <PopoverContent side="top" sideOffset={8} align="start" className="w-80 bg-brain-raised">
            <CheatSheet onSelect={handleCheatSelect} />
          </PopoverContent>
        </Popover>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or type a command..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-xs text-foreground placeholder:text-[#62627a] outline-none"
          style={{ maxHeight: 120, fieldSizing: 'content' } as React.CSSProperties}
        />

        <Button
          variant="ghost"
          size="icon-xs"
          className="flex-shrink-0 mb-0.5 bg-brain-accent/20 text-brain-accent hover:bg-brain-accent/30 disabled:opacity-30 disabled:bg-transparent"
          disabled={!value.trim()}
          onClick={onSend}
          title="Send"
        >
          <ArrowUp className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
