import { useCallback, useMemo } from 'react'
import { Archive } from 'lucide-react'
import { useBrain } from '@/hooks/use-brain'
import { useArchived } from '@/hooks/use-archived'
import { useUIStore } from '@/stores/ui-store'
import { SECTIONS, SECTION_COLORS, SECTION_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { SectionName } from '@/lib/types'

interface FilterButtonProps {
  label: string
  filterKey: string
  count: number
  color?: string
  isActive: boolean
  onClick: (key: string) => void
  icon?: React.ReactNode
}

function FilterButton({ label, filterKey, count, color, isActive, onClick, icon }: FilterButtonProps) {
  return (
    <button
      onClick={() => onClick(filterKey)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
        'hover:bg-brain-hover',
        isActive ? 'bg-brain-surface text-foreground' : 'text-muted-foreground',
      )}
    >
      {color && (
        <span
          className="w-0.5 h-4 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 text-left">{label}</span>
      <span
        className={cn(
          'text-[10px] tabular-nums',
          isActive ? 'text-foreground/70' : 'text-[#8585a0]',
        )}
      >
        {count}
      </span>
    </button>
  )
}

export function FilterList() {
  const activeFilter = useUIStore((s) => s.activeFilter)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const activeProject = useUIStore((s) => s.activeProject)
  const { data: brain } = useBrain(activeProject || undefined)
  const { data: archived } = useArchived()

  const counts = useMemo(() => {
    if (!brain) return { all: 0, workingStyle: 0, architecture: 0, agentRules: 0, decisions: 0, archived: 0 }

    const filterByProject = (entries: Array<{ project: string[] }>) => {
      if (!activeProject) return entries
      return entries.filter((e) => e.project.includes(activeProject))
    }

    const ws = filterByProject(brain.workingStyle).length
    const arch = filterByProject(brain.architecture).length
    const rules = filterByProject(brain.agentRules).length
    const dec = filterByProject(brain.decisions).length
    const arc = activeProject
      ? (archived ?? []).filter((e) => e.project.includes(activeProject)).length
      : (archived ?? []).length

    return {
      all: ws + arch + rules + dec,
      workingStyle: ws,
      architecture: arch,
      agentRules: rules,
      decisions: dec,
      archived: arc,
    }
  }, [brain, archived, activeProject])

  const handleClick = useCallback(
    (key: string) => setActiveFilter(key),
    [setActiveFilter],
  )

  return (
    <div className="shrink-0 px-3 pb-2">
      <FilterButton
        label="All"
        filterKey="all"
        count={counts.all}
        isActive={activeFilter === 'all'}
        onClick={handleClick}
      />
      {SECTIONS.map((section) => (
        <FilterButton
          key={section}
          label={SECTION_LABELS[section]}
          filterKey={section}
          count={counts[section as SectionName]}
          color={SECTION_COLORS[section]}
          isActive={activeFilter === section}
          onClick={handleClick}
        />
      ))}
      <FilterButton
        label="Archived"
        filterKey="archived"
        count={counts.archived}
        isActive={activeFilter === 'archived'}
        onClick={handleClick}
        icon={<Archive className="size-3 text-[#8585a0]" />}
      />
    </div>
  )
}
