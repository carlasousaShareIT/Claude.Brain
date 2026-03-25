interface SuggestionsProps {
  onSelect: (text: string) => void;
}

const SUGGESTIONS = [
  'What do we know about MFE?',
  'Show archived',
  'Mission status',
  'Export brain',
];

export function Suggestions({ onSelect }: SuggestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-8">
      <p className="text-xs text-muted-foreground">Try a command or question.</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="rounded-full border border-[#62627a]/30 bg-brain-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brain-accent/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
