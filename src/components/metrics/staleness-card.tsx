import { SECTION_COLORS, SECTION_LABELS } from '@/lib/constants'
import { truncate, timeAgo } from '@/lib/utils'

interface StalenessCardProps {
  avgAgeDays: number
  oldestEntry: { text: string; section: string; createdAt: string } | null
  newestEntry: { text: string; section: string; createdAt: string } | null
  sessionsCount: number
  annotationsCount: number
}

function EntryRow({ entry }: { entry: { text: string; section: string; createdAt: string } }) {
  const color = SECTION_COLORS[entry.section] ?? '#9d9db5'
  const label = SECTION_LABELS[entry.section] ?? entry.section

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] text-[#62627a]">{timeAgo(entry.createdAt)}</span>
      </div>
      <p className="text-xs text-foreground leading-snug">
        {truncate(entry.text, 80)}
      </p>
    </div>
  )
}

export function StalenessCard({
  avgAgeDays,
  oldestEntry,
  newestEntry,
  sessionsCount,
  annotationsCount,
}: StalenessCardProps) {
  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-baseline gap-6">
        <div>
          <span className="text-2xl tabular-nums font-semibold text-foreground">
            {Math.round(avgAgeDays)}
          </span>
          <span className="ml-1 text-xs text-muted-foreground">avg days old</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            <span className="tabular-nums font-medium text-foreground">{sessionsCount}</span> sessions
          </span>
          <span>
            <span className="tabular-nums font-medium text-foreground">{annotationsCount}</span> annotations
          </span>
        </div>
      </div>

      {/* Oldest / newest */}
      <div className="space-y-3">
        {oldestEntry && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
              Oldest
            </p>
            <EntryRow entry={oldestEntry} />
          </div>
        )}
        {newestEntry && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
              Newest
            </p>
            <EntryRow entry={newestEntry} />
          </div>
        )}
      </div>
    </div>
  )
}
