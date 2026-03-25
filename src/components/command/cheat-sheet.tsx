import { ScrollArea } from '@/components/ui/scroll-area';

interface CheatSheetProps {
  onSelect: (command: string) => void;
}

interface CommandEntry {
  cmd: string;
  desc: string;
}

interface CommandGroup {
  label: string;
  commands: CommandEntry[];
}

const GROUPS: CommandGroup[] = [
  {
    label: 'Add entries',
    commands: [
      { cmd: 'add style: ...', desc: 'Add working style entry.' },
      { cmd: 'add arch: ...', desc: 'Add architecture entry.' },
      { cmd: 'add rule: ...', desc: 'Add agent rule.' },
      { cmd: 'add decision: ...', desc: 'Add decision.' },
      { cmd: 'remember that ...', desc: 'Auto-detect section.' },
    ],
  },
  {
    label: 'Missions',
    commands: [
      { cmd: 'add mission: Name', desc: 'Create empty mission.' },
      { cmd: 'mission: Name | T1; T2', desc: 'Create with tasks.' },
      { cmd: 'add task: Name | T1; T2', desc: 'Add tasks to mission.' },
      { cmd: 'mission status', desc: 'Show active missions.' },
    ],
  },
  {
    label: 'Manage',
    commands: [
      { cmd: 'firm rule: ...', desc: 'Set confidence to firm.' },
      { cmd: 'tentative arch: ...', desc: 'Set to tentative.' },
      { cmd: 'mark X as firm', desc: 'Toggle confidence.' },
      { cmd: 'resolve: ...', desc: 'Resolve a decision.' },
    ],
  },
  {
    label: 'Remove',
    commands: [
      { cmd: 'archive rule: ...', desc: 'Archive an entry.' },
      { cmd: 'unarchive: ...', desc: 'Restore archived entry.' },
      { cmd: 'show archived', desc: 'List archived entries.' },
    ],
  },
  {
    label: 'Search',
    commands: [
      { cmd: 'search ...', desc: 'Search brain entries.' },
      { cmd: 'find ...', desc: 'Alias for search.' },
      { cmd: 'what do we know about ...', desc: 'Natural search.' },
    ],
  },
  {
    label: 'Projects & Utilities',
    commands: [
      { cmd: 'close project: id', desc: 'Close a project.' },
      { cmd: 'reopen project: id', desc: 'Reopen a project.' },
      { cmd: 'export', desc: 'Export brain as JSON.' },
      { cmd: 'clear log', desc: 'Clear the activity log.' },
    ],
  },
];

export function CheatSheet({ onSelect }: CheatSheetProps) {
  return (
    <ScrollArea className="max-h-[400px] overflow-hidden">
      <div className="space-y-3 p-1">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.commands.map((entry) => (
                <button
                  key={entry.cmd}
                  className="w-full flex items-baseline gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-brain-hover group"
                  onClick={() => onSelect(entry.cmd.replace('...', '').replace('X', '').trimEnd())}
                >
                  <code className="text-[11px] text-brain-accent font-mono whitespace-nowrap">
                    {entry.cmd}
                  </code>
                  <span className="text-[10px] text-[#62627a] group-hover:text-muted-foreground truncate">
                    {entry.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
