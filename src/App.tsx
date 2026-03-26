import { useEffect } from 'react'
import { useSSE } from '@/hooks/use-sse'
import { useUIStore } from '@/stores/ui-store'
import { Sidebar } from '@/components/layout/sidebar'
import { MainPanel } from '@/components/layout/main-panel'
import { CommandPanel } from '@/components/layout/command-panel'
import { ErrorBoundary } from '@/components/error-boundary'

const VALID_TABS = ['neural', 'metrics', 'missions', 'sessions'] as const
type ActiveTab = typeof VALID_TABS[number]

function App() {
  useSSE()
  const serverLive = useUIStore((s) => s.serverLive)

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if ((VALID_TABS as readonly string[]).includes(hash)) {
        useUIStore.getState().setActiveTab(hash as ActiveTab)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-brain-base">
      <ErrorBoundary name="Sidebar"><Sidebar /></ErrorBoundary>
      <ErrorBoundary name="MainPanel"><MainPanel /></ErrorBoundary>
      <ErrorBoundary name="CommandPanel"><CommandPanel /></ErrorBoundary>
      {!serverLive && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 rounded-md bg-brain-amber/20 border border-brain-amber/30 px-3 py-1.5 text-xs text-brain-amber">
          Brain server offline — reconnecting...
        </div>
      )}
    </div>
  )
}

export default App
