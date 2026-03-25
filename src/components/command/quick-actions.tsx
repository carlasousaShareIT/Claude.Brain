import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Play,
  Search,
  CheckCircle,
  Archive,
  X,
  Download,
} from 'lucide-react';

interface QuickActionsProps {
  onInsertPrefix: (prefix: string) => void;
  onTriggerAction: (action: string) => void;
}

export function QuickActions({ onInsertPrefix, onTriggerAction }: QuickActionsProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto">
      {/* Add */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="xs" className="text-brain-accent hover:bg-brain-accent/10 gap-1">
            <Plus className="size-3" />
            <span>Add</span>
          </Button>}
        />
        <DropdownMenuContent side="top" sideOffset={4}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Add entry</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onInsertPrefix('add style: ')}>
              Working Style
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertPrefix('add arch: ')}>
              Architecture
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertPrefix('add rule: ')}>
              Agent Rule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertPrefix('add decision: ')}>
              Decision
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertPrefix('remember that ')}>
              Natural
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mission */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="xs" className="text-brain-green hover:bg-brain-green/10 gap-1">
            <Play className="size-3" />
            <span>Mission</span>
          </Button>}
        />
        <DropdownMenuContent side="top" sideOffset={4}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Missions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onInsertPrefix('add mission: ')}>
              New mission
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertPrefix('mission: Name | Task1; Task2; Task3')}>
              Mission with tasks
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertPrefix('add task: Mission Name | Task1; Task2')}>
              Add tasks
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTriggerAction('mission status')}>
              Mission status
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <Button
        variant="ghost"
        size="xs"
        className="text-brain-cyan hover:bg-brain-cyan/10 gap-1"
        onClick={() => onInsertPrefix('search ')}
      >
        <Search className="size-3" />
        <span>Search</span>
      </Button>

      {/* Resolve */}
      <Button
        variant="ghost"
        size="xs"
        className="text-brain-amber hover:bg-brain-amber/10 gap-1"
        onClick={() => onInsertPrefix('resolve: ')}
      >
        <CheckCircle className="size-3" />
        <span>Resolve</span>
      </Button>

      {/* Archive */}
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground hover:bg-brain-hover gap-1"
        onClick={() => onInsertPrefix('archive ')}
      >
        <Archive className="size-3" />
        <span>Archive</span>
      </Button>

      {/* Remove */}
      <Button
        variant="ghost"
        size="xs"
        className="text-brain-red hover:bg-brain-red/10 gap-1"
        onClick={() => onInsertPrefix('remove ')}
        title="Remove entry"
      >
        <X className="size-3" />
      </Button>

      {/* Export */}
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground hover:bg-brain-hover gap-1"
        onClick={() => onTriggerAction('export')}
      >
        <Download className="size-3" />
      </Button>
    </div>
  );
}
