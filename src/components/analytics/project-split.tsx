interface ProjectSplitData {
  metaMinutes: number
  productMinutes: number
  byProject: Record<string, number>
}

const PROJECT_PALETTE = [
  '#a78bfa',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#fb923c',
  '#818cf8',
  '#e879f9',
]

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function ProjectSplit({ data }: { data: ProjectSplitData }) {
  const total = data.metaMinutes + data.productMinutes
  const metaPct = total > 0 ? Math.round((data.metaMinutes / total) * 100) : 0
  const productPct = total > 0 ? 100 - metaPct : 0

  const sortedProjects = Object.entries(data.byProject).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-brain-surface">
          {total > 0 && (
            <>
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${metaPct}%`,
                  backgroundColor: '#a78bfa',
                }}
                title={`Meta-work: ${metaPct}%`}
              />
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${productPct}%`,
                  backgroundColor: '#34d399',
                }}
                title={`Product: ${productPct}%`}
              />
            </>
          )}
          {total === 0 && (
            <div className="h-full w-full rounded-full bg-brain-surface" />
          )}
        </div>

        {/* Labels */}
        <div className="mt-2 space-y-0.5">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: '#a78bfa' }}
            />
            <span className="text-foreground/80">Meta-work:</span>
            <span className="tabular-nums font-medium text-foreground">
              {metaPct}%
            </span>
            <span className="text-muted-foreground">({formatMinutes(data.metaMinutes)})</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: '#34d399' }}
            />
            <span className="text-foreground/80">Product:</span>
            <span className="tabular-nums font-medium text-foreground">
              {productPct}%
            </span>
            <span className="text-muted-foreground">({formatMinutes(data.productMinutes)})</span>
          </div>
        </div>
      </div>

      {/* Per-project breakdown */}
      {sortedProjects.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            By project
          </p>
          {sortedProjects.map(([project, minutes], i) => {
            const color = PROJECT_PALETTE[i % PROJECT_PALETTE.length]
            return (
              <div
                key={project}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground/80">
                  {project}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatMinutes(minutes)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-muted-foreground">No session time data yet.</p>
      )}
    </div>
  )
}
