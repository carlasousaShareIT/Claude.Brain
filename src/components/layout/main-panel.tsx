import { useUIStore } from '@/stores/ui-store'
import { NavHeader } from '@/components/layout/nav-header'
import { TabHelp } from '@/components/layout/tab-help'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { MissionsView } from '@/components/missions/missions-view'
import { MetricsView } from '@/components/metrics/metrics-view'
import { NeuralMapView } from '@/components/neural-map/neural-map-view'
import { SessionsView } from '@/components/sessions/sessions-view'
import { RemindersView } from '@/components/reminders/reminders-view'
import { ExperimentsView } from '@/components/experiments/experiments-view'
import { SkillsView } from '@/components/skills/skills-view'
import { ObserverView } from '@/components/observer/observer-view'
import { ObserverStrip } from '@/components/observer/observer-strip'
import { AnalyticsView } from '@/components/analytics/analytics-view'

export function MainPanel() {
  const activeView = useUIStore((s) => s.activeView)
  const isDashboard = activeView === 'dashboard'

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-l border-brain-surface">
      <NavHeader />
      {!isDashboard && <TabHelp />}
      {activeView !== 'observer' && <ObserverStrip />}
      <div className="flex-1 overflow-hidden min-h-0">
        {isDashboard && <DashboardView />}
        {activeView === 'neural' && <NeuralMapView />}
        {activeView === 'metrics' && <MetricsView />}
        {activeView === 'missions' && <MissionsView />}
        {activeView === 'sessions' && <SessionsView />}
        {activeView === 'reminders' && <RemindersView />}
        {activeView === 'experiments' && <ExperimentsView />}
        {activeView === 'skills' && <SkillsView />}
        {activeView === 'observer' && <ObserverView />}
        {activeView === 'analytics' && <AnalyticsView />}
      </div>
    </div>
  )
}
