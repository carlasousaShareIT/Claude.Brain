interface ConfidenceSplitProps {
  byConfidence: { firm: number; tentative: number }
}

export function ConfidenceSplit({ byConfidence }: ConfidenceSplitProps) {
  const total = byConfidence.firm + byConfidence.tentative
  const firmPct = total > 0 ? Math.round((byConfidence.firm / total) * 100) : 0
  const tentPct = total > 0 ? 100 - firmPct : 0

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground">Firm</span>
          <span className="tabular-nums text-muted-foreground">
            {byConfidence.firm} ({firmPct}%)
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-brain-surface">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${firmPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground">Tentative</span>
          <span className="tabular-nums text-muted-foreground">
            {byConfidence.tentative} ({tentPct}%)
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-brain-surface">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-300"
            style={{ width: `${tentPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
