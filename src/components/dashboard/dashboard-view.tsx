import { useUIStore } from '@/stores/ui-store'
import { useDashboard } from '@/hooks/use-dashboard'
import { MissionsCard } from './missions-card'
import { SessionsCard } from './sessions-card'
import { RemindersCard } from './reminders-card'
import { ExperimentsCard } from './experiments-card'
import { AnalyticsCard } from './analytics-card'
import { HealthCard } from './health-card'
import { ObserverCard } from './observer-card'

export function DashboardView() {
  const pushView = useUIStore((s) => s.pushView)
  const { missions, sessions, reminders, experiments, analytics, metrics, watchers, violationStats } = useDashboard()
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-2 gap-4">
          <MissionsCard data={missions.data} onClick={() => pushView('missions')} />
          <SessionsCard data={sessions.data} onClick={() => pushView('sessions')} />
          <RemindersCard data={reminders.data} onClick={() => pushView('reminders')} />
          <ExperimentsCard data={experiments.data} onClick={() => pushView('experiments')} />
          <AnalyticsCard data={analytics.data} onClick={() => pushView('analytics')} />
          <HealthCard data={metrics.data} onClick={() => pushView('metrics')} />
          <ObserverCard watchers={watchers.data} stats={violationStats.data} onClick={() => pushView('observer')} />
        </div>
      </div>
    </div>
  )
}
