import type { Skill } from '@/lib/types'

interface SkillsCardProps {
  data: Skill[] | undefined
  onClick: () => void
}

interface TypeCount {
  type: string
  count: number
}

function countByType(skills: Skill[]): TypeCount[] {
  const counts = new Map<string, number>()
  for (const s of skills) {
    const key = s.type || 'untyped'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

export function SkillsCard({ data, onClick }: SkillsCardProps) {
  const skills = data ?? []
  const total = skills.length
  const typeBreakdown = countByType(skills)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-brain-surface bg-brain-raised p-5 text-left transition-colors hover:border-brain-accent/30 hover:bg-brain-hover"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">Skills</h2>
        {data && (
          <span className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] font-medium text-[#8585a0]">
            {total}
          </span>
        )}
      </div>
      {!data ? (
        <>
          <div className="h-7 w-8 rounded bg-brain-base animate-pulse" />
          <div className="h-3 w-24 rounded bg-brain-base animate-pulse mt-2" />
        </>
      ) : total > 0 ? (
        <>
          <p className="text-2xl font-semibold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {typeBreakdown.length} type{typeBreakdown.length !== 1 ? 's' : ''}
          </p>
          <div className="mt-2 space-y-0.5">
            {typeBreakdown.slice(0, 4).map((row) => (
              <div
                key={row.type}
                className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
              >
                <span className="truncate">{row.type}</span>
                <span className="shrink-0 text-[#62627a]">{row.count}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No skills yet.</p>
      )}
    </button>
  )
}
