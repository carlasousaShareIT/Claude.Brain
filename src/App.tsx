import { useSSE } from '@/hooks/use-sse'
import { useUIStore } from '@/stores/ui-store'
import { Sidebar } from '@/components/layout/sidebar'
import { MainPanel } from '@/components/layout/main-panel'
import { CommandPanel } from '@/components/layout/command-panel'

function App() {
  useSSE()
  const serverLive = useUIStore((s) => s.serverLive)

  return (
    <div className="flex h-screen overflow-hidden bg-brain-base">
      <Sidebar />
      <MainPanel />
      <CommandPanel />
      {!serverLive && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 rounded-md bg-brain-amber/20 border border-brain-amber/30 px-3 py-1.5 text-xs text-brain-amber">
          Brain server offline — reconnecting...
        </div>
      )}
    </div>
  )
}

export default App
