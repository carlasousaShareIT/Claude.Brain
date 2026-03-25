import { useCallback, useState } from 'react'
import { Download, FolderClosed, FolderOpen } from 'lucide-react'
import { useProjects } from '@/hooks/use-projects'
import { useUIStore } from '@/stores/ui-store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Project } from '@/lib/types'

export function SidebarFooter() {
  const activeProject = useUIStore((s) => s.activeProject)
  const { data: projects, closeProject, reopenProject } = useProjects()
  const [exporting, setExporting] = useState(false)

  const project = projects?.find((p: Project) => p.id === activeProject)

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const markdown = await api.getContext(
        activeProject ? { project: activeProject } : undefined,
      )
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `brain${activeProject ? `-${activeProject}` : ''}.md`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [activeProject])

  const handleToggleProject = useCallback(() => {
    if (!project) return
    if (project.status === 'active') {
      closeProject.mutate({ id: project.id })
    } else {
      reopenProject.mutate({ id: project.id })
    }
  }, [project, closeProject, reopenProject])

  return (
    <div className="shrink-0">
      <Separator className="bg-brain-surface" />
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <Button
          variant="ghost"
          size="xs"
          onClick={handleExport}
          disabled={exporting}
          className="flex-1 justify-start text-xs text-muted-foreground"
        >
          <Download className="size-3 mr-1.5" />
          {exporting ? 'Exporting...' : 'Export'}
        </Button>

        {activeProject && project && (
          <Button
            variant="ghost"
            size="xs"
            onClick={handleToggleProject}
            className="flex-1 justify-start text-xs text-muted-foreground"
          >
            {project.status === 'active' ? (
              <>
                <FolderClosed className="size-3 mr-1.5" />
                Close project
              </>
            ) : (
              <>
                <FolderOpen className="size-3 mr-1.5" />
                Reopen project
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
