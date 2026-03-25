import { Button } from '@/components/ui/button';
import { PenLine } from 'lucide-react';

interface CommandHeaderProps {
  onClear: () => void;
}

export function CommandHeader({ onClear }: CommandHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <h2 className="text-sm font-medium text-foreground">Commands</h2>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        onClick={onClear}
        title="New chat"
      >
        <PenLine className="size-3.5" />
      </Button>
    </div>
  );
}
