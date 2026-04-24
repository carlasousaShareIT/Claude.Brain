import { LayoutDashboard } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import type { DetailView } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

const VIEWS: { key: DetailView; label: string }[] = [
  { key: 'missions', label: 'Missions' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'experiments', label: 'Experiments' },
  { key: 'skills', label: 'Skills' },
  { key: 'observer', label: 'Observer' },
  { key: 'neural', label: 'Neural Map' },
  { key: 'account', label: 'Account' },
]

export function NavHeader() {
  const activeView = useUIStore((s) => s.activeView)
  const pushView = useUIStore((s) => s.pushView)
  const popView = useUIStore((s) => s.popView)

  return (
    <div className="flex shrink-0 items-center border-b border-white/5 px-2">
      <button
        onClick={popView}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-2.5 text-xs transition-colors',
          activeView === 'dashboard'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
      </button>
      {VIEWS.map((v) => (
        <button
          key={v.key}
          onClick={() => pushView(v.key)}
          className={cn(
            'relative px-2.5 py-2.5 text-xs font-medium transition-colors',
            activeView === v.key
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/80',
          )}
        >
          {v.label}
          {activeView === v.key && (
            <span className="absolute bottom-0 left-2.5 right-2.5 h-0.5 rounded-full bg-brain-accent" />
          )}
        </button>
      ))}
    </div>
  )
}
