import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { QueryError } from '@/components/ui/query-error'
import { cn, projectColor } from '@/lib/utils'
import { useSkills } from '@/hooks/use-skills'
import { useProjects } from '@/hooks/use-projects'
import { SkillCard } from './skill-card'

export function SkillsView() {
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState('')
  const [addContent, setAddContent] = useState('')
  const [addProject, setAddProject] = useState('')
  const [addTags, setAddTags] = useState('')

  // Type filtering happens client-side so the type chip row stays stable when
  // a type is selected (otherwise uniqueTypes would collapse to the picked type).
  const {
    data: skills,
    isLoading,
    isError,
    refetch,
    createSkill,
  } = useSkills(projectFilter ?? undefined)

  const { data: projects } = useProjects()

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>()
    let hasUntyped = false
    for (const s of skills ?? []) {
      if (s.type) types.add(s.type)
      else hasUntyped = true
    }
    const sorted = Array.from(types).sort()
    if (hasUntyped) sorted.push('untyped')
    return sorted
  }, [skills])

  const resetAddForm = useCallback(() => {
    setAddName('')
    setAddType('')
    setAddContent('')
    setAddProject('')
    setAddTags('')
  }, [])

  const handleAddSubmit = useCallback(() => {
    const name = addName.trim()
    const type = addType.trim()
    const content = addContent
    if (!name || !type || !content.trim()) return
    const project = addProject
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    const tags = addTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    createSkill.reset()
    createSkill.mutate(
      { name, type, content, project, tags },
      {
        onSuccess: () => {
          resetAddForm()
          setShowAdd(false)
        },
      },
    )
  }, [addName, addType, addContent, addProject, addTags, createSkill, resetAddForm])

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        setShowAdd(false)
        resetAddForm()
      }
    },
    [resetAddForm],
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading skills...</p>
      </div>
    )
  }

  if (isError) {
    return <QueryError message="Failed to load skills." onRetry={refetch} />
  }

  const rawList = skills ?? []
  const list =
    typeFilter === null
      ? rawList
      : typeFilter === 'untyped'
        ? rawList.filter((s) => !s.type)
        : rawList.filter((s) => s.type === typeFilter)
  const projectOptions = projects ?? []

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-white/5 px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-foreground">Skills</h2>
            <p className="text-xs text-[#62627a]">
              Reusable knowledge snippets grouped by type.
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-[#62627a] hover:text-foreground"
            onClick={() => setShowAdd((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Project filter */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-[#62627a]">
              Project:
            </span>
            <button
              onClick={() => setProjectFilter(null)}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                projectFilter === null
                  ? 'bg-brain-surface text-foreground'
                  : 'text-[#62627a] hover:text-foreground/80',
              )}
            >
              All
            </button>
            {projectOptions.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectFilter(p.id)}
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                  projectFilter === p.id
                    ? 'text-foreground'
                    : 'text-[#62627a] hover:text-foreground/80',
                )}
                style={
                  projectFilter === p.id
                    ? { backgroundColor: `${projectColor(p.id)}30`, color: projectColor(p.id) }
                    : undefined
                }
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Type filter */}
          {uniqueTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] uppercase tracking-wider text-[#62627a]">
                Type:
              </span>
              <button
                onClick={() => setTypeFilter(null)}
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                  typeFilter === null
                    ? 'bg-brain-surface text-foreground'
                    : 'text-[#62627a] hover:text-foreground/80',
                )}
              >
                All
              </button>
              {uniqueTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    typeFilter === t
                      ? 'bg-brain-surface text-foreground'
                      : 'text-[#62627a] hover:text-foreground/80',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-4 pt-3 pb-4">
          {/* Inline add form */}
          {showAdd && (
            <div className="flex flex-col gap-2 rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5">
              <input
                autoFocus
                type="text"
                placeholder="Skill name…"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="min-w-0 bg-transparent text-sm text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Type (free-text, e.g. pattern, recipe, reference)…"
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="min-w-0 bg-transparent text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <textarea
                placeholder="Content…"
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                onKeyDown={handleAddKeyDown}
                rows={5}
                className="min-w-0 resize-y rounded bg-brain-surface px-2 py-1.5 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
              />

              {/* Project multi-select */}
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#62627a]">
                  Projects
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {projectOptions.map((p) => {
                    const selected = addProject
                      .split(',')
                      .map((x) => x.trim())
                      .includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          const current = addProject
                            .split(',')
                            .map((x) => x.trim())
                            .filter((x) => x.length > 0)
                          const next = selected
                            ? current.filter((x) => x !== p.id)
                            : [...current, p.id]
                          setAddProject(next.join(', '))
                        }}
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                          selected
                            ? 'text-foreground'
                            : 'text-[#62627a] hover:text-foreground/80',
                        )}
                        style={
                          selected
                            ? { backgroundColor: `${projectColor(p.id)}30`, color: projectColor(p.id) }
                            : undefined
                        }
                      >
                        {p.name}
                      </button>
                    )
                  })}
                  {projectOptions.length === 0 && (
                    <span className="text-xs text-[#62627a]">No projects available.</span>
                  )}
                </div>
              </div>

              <input
                type="text"
                placeholder="Tags (comma-separated)…"
                value={addTags}
                onChange={(e) => setAddTags(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="min-w-0 bg-transparent text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
              />

              {createSkill.isError && (
                <p className="text-xs text-red-400">
                  {createSkill.error instanceof Error
                    ? createSkill.error.message
                    : 'Failed to save.'}
                </p>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-[#62627a] hover:text-foreground"
                  onClick={() => {
                    setShowAdd(false)
                    resetAddForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-brain-accent hover:text-brain-accent/80"
                  onClick={handleAddSubmit}
                  disabled={
                    !addName.trim() ||
                    !addType.trim() ||
                    !addContent.trim() ||
                    createSkill.isPending
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showAdd && list.length === 0 && (
            <p className="py-8 text-center text-xs text-[#62627a]">
              No skills. Add one to capture reusable knowledge.
            </p>
          )}

          {/* Skill cards */}
          {list.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
