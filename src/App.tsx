import { useEffect } from 'react'
import { Terminal, X } from 'lucide-react'
import { useSSE } from '@/hooks/use-sse'
import { useUIStore } from '@/stores/ui-store'
import { Sidebar } from '@/components/layout/sidebar'
import { MainPanel } from '@/components/layout/main-panel'
import { CommandPanel } from '@/components/layout/command-panel'
import { ErrorBoundary } from '@/components/error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

const VALID_TABS = ['neural', 'metrics', 'missions', 'sessions', 'reminders', 'experiments'] as const
type ActiveTab = typeof VALID_TABS[number]

function App() {
  useSSE()
  const serverLive = useUIStore((s) => s.serverLive)
  const commandPanelOpen = useUIStore((s) => s.commandPanelOpen)
  const setCommandPanelOpen = useUIStore((s) => s.setCommandPanelOpen)

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
    <TooltipProvider>
    <div className="flex h-screen overflow-hidden bg-brain-base">
      <ErrorBoundary name="Sidebar"><Sidebar /></ErrorBoundary>
      <ErrorBoundary name="MainPanel"><MainPanel /></ErrorBoundary>

      {/* Command panel drawer */}
      {commandPanelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setCommandPanelOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-[400px] max-w-[90vw] animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="xs"
              className="absolute top-2 right-2 z-10 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setCommandPanelOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <ErrorBoundary name="CommandPanel"><CommandPanel /></ErrorBoundary>
          </div>
        </div>
      )}

      {/* Floating command trigger */}
      {!commandPanelOpen && (
        <Button
          variant="ghost"
          size="sm"
          className="fixed bottom-4 right-4 z-30 h-10 w-10 rounded-full bg-brain-raised border border-brain-surface shadow-lg hover:bg-brain-hover"
          onClick={() => setCommandPanelOpen(true)}
        >
          <Terminal className="h-5 w-5 text-brain-accent" />
        </Button>
      )}

      {!serverLive && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 rounded-md bg-brain-amber/20 border border-brain-amber/30 px-3 py-1.5 text-xs text-brain-amber">
          Brain server offline — reconnecting...
        </div>
      )}
    </div>
    </TooltipProvider>
  )
}

export default App
