import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useProjects } from '@/hooks/use-projects'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/types'

export function SidebarHeader() {
  const queryClient = useQueryClient()
  const serverLive = useUIStore((s) => s.serverLive)
  const activeProject = useUIStore((s) => s.activeProject)
  const setActiveProject = useUIStore((s) => s.setActiveProject)
  const { data: projects } = useProjects()
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncing, setSyncing] = useState(false)

  const handleSync = useCallback(async () => {
    setSyncing(true)
    await queryClient.invalidateQueries()
    setLastSync(new Date())
    setSyncing(false)
  }, [queryClient])

  const handleProjectChange = useCallback(
    (val: string | null) => {
      setActiveProject(val === 'all' || val === null ? '' : val)
    },
    [setActiveProject],
  )

  const activeProjectName =
    projects?.find((p: Project) => p.id === activeProject)?.name ?? 'All projects'

  return (
    <div className="shrink-0 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">Claude Brain</h1>
          <span
            className={cn(
              'size-2 rounded-full',
              serverLive
                ? 'bg-brain-green animate-pulse'
                : 'bg-brain-red',
            )}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw
            className={cn('size-3.5 text-muted-foreground', syncing && 'animate-spin')}
          />
        </Button>
      </div>

      <p className="mt-0.5 text-xs text-muted-foreground">
        {activeProject ? activeProjectName : 'All projects'}
      </p>

      {lastSync && (
        <p className="mt-1 text-[10px] text-[#62627a]">
          Synced {lastSync.toLocaleTimeString()}
        </p>
      )}

      <div className="mt-3">
        <Select
          value={activeProject || 'all'}
          onValueChange={handleProjectChange}
        >
          <SelectTrigger size="sm" className="w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects?.map((p: Project) => (
              <SelectItem key={p.id} value={p.id}>
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full mr-1.5',
                    p.status === 'active' ? 'bg-brain-green' : 'bg-[#62627a]',
                  )}
                />
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
