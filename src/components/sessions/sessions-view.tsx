import { useState } from 'react'
import { X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useSessions } from '@/hooks/use-sessions'
import { useUIStore } from '@/stores/ui-store'
import { SessionCard } from './session-card'

export function SessionsView() {
  const { data: sessions, isLoading } = useSessions()
  const sessionFilterId = useUIStore((s) => s.sessionFilterId)
  const setSessionFilterId = useUIStore((s) => s.setSessionFilterId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeSession = sessions?.find((s) => s.id === sessionFilterId)

  const handleFilter = (id: string) => {
    setSessionFilterId(id === sessionFilterId ? '' : id)
  }

  const handleToggleExpand = (id: string) => {
    setExpandedId(id === expandedId ? null : id)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#62627a]">Loading sessions...</p>
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#62627a]">No sessions found.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {sessionFilterId && activeSession && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 bg-brain-raised/50 px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Filtering sidebar to session:{' '}
            <span className="font-medium text-foreground">
              {activeSession.label ?? activeSession.id.slice(0, 12)}
            </span>
          </p>
          <Button
            variant="ghost"
            size="xs"
            className="h-5 w-5 p-0 text-[#62627a] hover:text-foreground"
            onClick={() => setSessionFilterId('')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="space-y-2 p-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onFilter={handleFilter}
              isFiltered={session.id === sessionFilterId}
              isExpanded={session.id === expandedId}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
