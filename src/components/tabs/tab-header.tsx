import { useUIStore } from '@/stores/ui-store'
import { useAutoHealth } from '@/hooks/use-health'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'neural', label: 'Neural Map' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'missions', label: 'Missions' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'experiments', label: 'Experiments' },
  { key: 'observer', label: 'Observer' },
] as const

export function TabHeader() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const { data: healthData } = useAutoHealth(activeTab === 'metrics')
  const staleCount = healthData?.staleEntries.length ?? 0

  return (
    <div role="tablist" className="flex shrink-0 items-center gap-1 border-b border-white/5 px-4">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'relative px-3 py-2.5 text-xs font-medium transition-colors',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.key === 'metrics' && staleCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brain-amber/20 px-1 text-[10px] font-semibold leading-none text-brain-amber">
                  {staleCount}
                </span>
              )}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brain-accent" />
            )}
          </button>
        )
      })}
    </div>
  )
}
