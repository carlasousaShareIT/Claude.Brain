import { useUIStore } from '@/stores/ui-store'
import { TabHeader } from '@/components/tabs/tab-header'
import { MissionsView } from '@/components/missions/missions-view'
import { MetricsView } from '@/components/metrics/metrics-view'
import { NeuralMapView } from '@/components/neural-map/neural-map-view'

export function MainPanel() {
  const activeTab = useUIStore((s) => s.activeTab)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TabHeader />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'neural' && <NeuralMapView />}
        {activeTab === 'metrics' && <MetricsView />}
        {activeTab === 'missions' && <MissionsView />}
      </div>
    </div>
  )
}
