import { SECTION_COLORS, SECTION_LABELS } from '@/lib/constants'

interface SectionBreakdownProps {
  bySection: Record<string, number>
}

export function SectionBreakdown({ bySection }: SectionBreakdownProps) {
  const entries = Object.entries(bySection)
  const max = Math.max(...entries.map(([, count]) => count), 1)

  return (
    <div className="space-y-2.5">
      {entries.map(([section, count]) => {
        const color = SECTION_COLORS[section] ?? '#9d9db5'
        const label = SECTION_LABELS[section] ?? section
        const pct = (count / max) * 100

        return (
          <div key={section} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{label}</span>
              <span className="tabular-nums text-muted-foreground">{count}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-brain-surface">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
