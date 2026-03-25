import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'neural', label: 'Neural Map' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'missions', label: 'Missions' },
  { key: 'sessions', label: 'Sessions' },
] as const

export function TabHeader() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-white/5 px-4">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={cn(
            'relative px-3 py-2.5 text-xs font-medium transition-colors',
            activeTab === tab.key
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/80',
          )}
        >
          {tab.label}
          {activeTab === tab.key && (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brain-accent" />
          )}
        </button>
      ))}
    </div>
  )
}
