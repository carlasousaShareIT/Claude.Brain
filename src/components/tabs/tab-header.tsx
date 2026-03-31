import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'neural', label: 'Neural Map' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'missions', label: 'Missions' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'experiments', label: 'Experiments' },
] as const

export function TabHeader() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

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
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brain-accent" />
            )}
          </button>
        )
      })}
    </div>
  )
}
