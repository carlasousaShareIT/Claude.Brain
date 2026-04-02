import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'

function relativeExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  if (mins > 0) return `expires in ${mins}m`
  return `expires in ${secs}s`
}

export function LocksPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const queryClient = useQueryClient()

  const { data: locks = [], isLoading } = useQuery({
    queryKey: ['locks'],
    queryFn: () => api.getLocks(),
    refetchInterval: 10000,
  })

  const forceRelease = useMutation({
    mutationFn: (id: number) => api.forceReleaseLock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locks'] }),
  })

  return (
    <div className="rounded-lg bg-brain-raised ring-1 ring-white/5">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-[#62627a]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#62627a]" />
        )}
        <Lock className="h-3.5 w-3.5 text-brain-accent" />
        <span className="text-sm font-medium text-foreground">File Locks</span>
        {locks.length > 0 && (
          <span className="rounded bg-brain-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-brain-accent">
            {locks.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-white/5 px-3 pb-2">
          {isLoading ? (
            <p className="py-3 text-center text-xs text-[#62627a]">Loading...</p>
          ) : locks.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#62627a]">No active locks.</p>
          ) : (
            <ScrollArea className="max-h-60">
              <div className="space-y-1 pt-2">
                {locks.map((lock) => (
                  <div
                    key={lock.id}
                    className="group flex items-center gap-2 rounded bg-brain-surface px-2 py-1.5"
                  >
                    <code className="min-w-0 flex-1 truncate text-xs text-foreground/80">
                      {lock.file}
                    </code>
                    <span className="shrink-0 rounded bg-brain-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-brain-accent">
                      {lock.agent}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#62627a]">
                      {relativeExpiry(lock.expiresAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 text-[#62627a] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      onClick={() => forceRelease.mutate(lock.id)}
                      disabled={forceRelease.isPending}
                      aria-label="Force release lock"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
