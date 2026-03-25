import { useState } from 'react'
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useHealth } from '@/hooks/use-health'
import { useArchived } from '@/hooks/use-archived'
import { cn, truncate } from '@/lib/utils'
import type { HealthEntry } from '@/lib/types'
import type { SectionName } from '@/lib/types'

const SECTION_COLORS: Record<string, string> = {
  workingStyle: 'text-brain-accent',
  architecture: 'text-brain-green',
  agentRules: 'text-brain-amber',
  decisions: 'text-brain-red',
}

function StaleEntryRow({ entry, onArchive }: { entry: HealthEntry; onArchive: () => void }) {
  const stale = entry.references.filter((r) => !r.exists)
  const healthy = entry.references.filter((r) => r.exists)

  return (
    <div className="rounded-md bg-brain-base p-3 space-y-1.5">
      <div className="flex items-start gap-2">
        <Badge
          variant="secondary"
          className={cn('text-[10px] shrink-0', SECTION_COLORS[entry.section] ?? 'text-muted-foreground')}
        >
          {entry.section}
        </Badge>
        <p className="text-xs text-foreground leading-snug flex-1">
          {truncate(entry.text, 80)}
        </p>
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0 text-[#62627a] hover:text-brain-red text-[10px]"
          onClick={onArchive}
        >
          Archive
        </Button>
      </div>
      <div className="pl-2 space-y-0.5">
        {stale.map((ref) => (
          <p key={ref.path} className="text-[10px] text-brain-red font-mono">
            ✗ {ref.path}
          </p>
        ))}
        {healthy.map((ref) => (
          <p key={ref.path} className="text-[10px] text-brain-green font-mono">
            ✓ {ref.path}
          </p>
        ))}
      </div>
    </div>
  )
}

export function HealthCard() {
  const [repoPath, setRepoPath] = useState('C:/Users/carla/Documents/Cludo')
  const { mutate: runCheck, data, isPending, error } = useHealth()
  const { archive } = useArchived()

  const handleArchive = (entry: HealthEntry) => {
    archive.mutate({ section: entry.section as SectionName, text: entry.text })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          className="flex-1 rounded-md border border-white/10 bg-brain-base px-2.5 py-1.5 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent"
          placeholder="Repo path..."
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => runCheck(repoPath)}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Scanning...
            </>
          ) : (
            'Run check'
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-brain-red">
          {(error as Error).message}
        </p>
      )}

      {data && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center gap-2">
            {data.staleEntries.length > 0 ? (
              <ShieldAlert className="h-4 w-4 text-brain-amber" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-brain-green" />
            )}
            <p className="text-sm text-foreground">
              {data.staleEntries.length > 0
                ? `${data.staleEntries.length} stale ${data.staleEntries.length === 1 ? 'reference' : 'references'} found across ${data.checkedEntries} entries`
                : `All ${data.checkedEntries} entries look healthy`}
            </p>
          </div>

          {data.noReferencesEntries > 0 && (
            <p className="text-[10px] text-[#62627a]">
              {data.noReferencesEntries} {data.noReferencesEntries === 1 ? 'entry has' : 'entries have'} no file references (skipped).
            </p>
          )}

          {data.staleEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-[#62627a] uppercase tracking-wide">Stale entries</p>
              {data.staleEntries.map((entry, i) => (
                <StaleEntryRow
                  key={i}
                  entry={entry}
                  onArchive={() => handleArchive(entry)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
