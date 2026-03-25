import { SECTION_COLORS, SECTION_LABELS, SECTIONS } from '@/lib/constants';

export function GraphLegend() {
  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-lg border border-white/5 bg-brain-raised/80 px-3 py-2 backdrop-blur-sm">
      {SECTIONS.map((section) => (
        <div key={section} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: SECTION_COLORS[section] }}
          />
          <span className="text-xs text-muted-foreground">
            {SECTION_LABELS[section]}
          </span>
        </div>
      ))}
    </div>
  );
}
