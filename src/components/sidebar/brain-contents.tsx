import { useMemo } from 'react'
import { useBrain } from '@/hooks/use-brain'
import { useArchived } from '@/hooks/use-archived'
import { useUIStore } from '@/stores/ui-store'
import { SECTIONS } from '@/lib/constants'
import { BrainItem } from '@/components/sidebar/brain-item'
import type { BrainEntry, Decision, SectionName } from '@/lib/types'

interface TaggedEntry {
  entry: BrainEntry | Decision
  section: string
}

export function BrainContents() {
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeProject = useUIStore((s) => s.activeProject)
  const sessionFilterId = useUIStore((s) => s.sessionFilterId)
  const { data: brain, isLoading } = useBrain(activeProject || undefined)
  const { data: archived } = useArchived()

  const entries = useMemo(() => {
    if (activeFilter === 'archived') return []
    if (!brain) return []

    const filterByProject = <T extends { project: string[]; sessionId?: string | null }>(items: T[]) => {
      let result = items
      if (activeProject) result = result.filter((e) => e.project.includes(activeProject))
      if (sessionFilterId) result = result.filter((e) => e.sessionId === sessionFilterId)
      return result
    }

    if (activeFilter === 'all') {
      const all: TaggedEntry[] = []
      for (const section of SECTIONS) {
        const sectionEntries = brain[section as SectionName] as BrainEntry[]
        for (const entry of filterByProject(sectionEntries)) {
          all.push({ entry, section })
        }
      }
      return all.sort(
        (a, b) =>
          new Date(b.entry.lastTouched || b.entry.createdAt).getTime() -
          new Date(a.entry.lastTouched || a.entry.createdAt).getTime(),
      )
    }

    const sectionKey = activeFilter as SectionName
    if (brain[sectionKey]) {
      return filterByProject(brain[sectionKey] as BrainEntry[])
        .map((entry) => ({ entry, section: sectionKey }))
        .sort(
          (a, b) =>
            new Date(b.entry.lastTouched || b.entry.createdAt).getTime() -
            new Date(a.entry.lastTouched || a.entry.createdAt).getTime(),
        )
    }

    return []
  }, [brain, activeFilter, activeProject, sessionFilterId])

  const archivedEntries = useMemo(() => {
    if (activeFilter !== 'archived') return []
    const items = archived ?? []
    if (!activeProject) return items
    return items.filter((e) => e.project.includes(activeProject))
  }, [archived, activeFilter, activeProject])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-[#62627a]">Loading...</p>
      </div>
    )
  }

  const isEmpty =
    activeFilter === 'archived'
      ? archivedEntries.length === 0
      : entries.length === 0

  if (isEmpty) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-[#62627a]">No entries.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-2 py-1 space-y-0.5">
        {activeFilter === 'archived'
          ? archivedEntries.map((entry) => (
              <BrainItem
                key={entry.text}
                entry={entry}
                section={entry.section}
                isArchived
              />
            ))
          : entries.map(({ entry, section }) => (
              <BrainItem
                key={`${section}-${entryKey(entry)}`}
                entry={entry}
                section={section}
              />
            ))}
      </div>
    </div>
  )
}

function entryKey(entry: BrainEntry | Decision): string {
  if ('decision' in entry) return (entry as Decision).decision
  return entry.text
}
