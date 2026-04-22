import { useState, useCallback } from 'react'
import { Eye, Pencil, Trash2, X, Check } from 'lucide-react'
import { cn, projectColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { useSkills } from '@/hooks/use-skills'
import type { Skill } from '@/lib/types'

interface SkillCardProps {
  skill: Skill
}

const PREVIEW_LENGTH = 200

function preview(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= PREVIEW_LENGTH) return trimmed
  return `${trimmed.slice(0, PREVIEW_LENGTH).trimEnd()}…`
}

export function SkillCard({ skill }: SkillCardProps) {
  const { updateSkill, deleteSkill } = useSkills()

  const [viewOpen, setViewOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [editName, setEditName] = useState(skill.name)
  const [editType, setEditType] = useState(skill.type)
  const [editContent, setEditContent] = useState(skill.content)
  const [editProject, setEditProject] = useState(skill.project.join(', '))
  const [editTags, setEditTags] = useState(skill.tags.join(', '))

  const openEdit = useCallback(() => {
    setEditName(skill.name)
    setEditType(skill.type)
    setEditContent(skill.content)
    setEditProject(skill.project.join(', '))
    setEditTags(skill.tags.join(', '))
    setEditing(true)
  }, [skill])

  const cancelEdit = useCallback(() => {
    setEditing(false)
  }, [])

  const handleSave = useCallback(() => {
    const name = editName.trim()
    const type = editType.trim()
    const content = editContent
    if (!name || !type || !content.trim()) return
    const project = editProject
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    updateSkill.reset()
    updateSkill.mutate(
      { id: skill.id, name, type, content, project, tags },
      {
        onSuccess: () => {
          setEditing(false)
        },
      },
    )
  }, [editName, editType, editContent, editProject, editTags, skill.id, updateSkill])

  const handleConfirmDelete = useCallback(() => {
    deleteSkill.reset()
    deleteSkill.mutate(skill.id, {
      onSuccess: () => {
        setConfirmDelete(false)
      },
    })
  }, [deleteSkill, skill.id])

  if (editing) {
    return (
      <div className="rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5">
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Skill name…"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="min-w-0 bg-transparent text-sm font-medium text-foreground placeholder:text-[#62627a] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Type…"
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="min-w-0 bg-transparent text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
          />
          <textarea
            placeholder="Content…"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={6}
            className="min-w-0 resize-y rounded bg-brain-surface px-2 py-1.5 text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Projects (comma-separated)…"
            value={editProject}
            onChange={(e) => setEditProject(e.target.value)}
            className="min-w-0 bg-transparent text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
          />
          <input
            type="text"
            placeholder="Tags (comma-separated)…"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            className="min-w-0 bg-transparent text-xs text-foreground placeholder:text-[#62627a] focus:outline-none"
          />
          {updateSkill.isError && (
            <p className="text-xs text-red-400">
              {updateSkill.error instanceof Error
                ? updateSkill.error.message
                : 'Failed to save.'}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              size="xs"
              variant="ghost"
              className="text-[#62627a] hover:text-foreground"
              onClick={cancelEdit}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="text-brain-accent hover:text-brain-accent/80"
              onClick={handleSave}
              disabled={
                !editName.trim() ||
                !editType.trim() ||
                !editContent.trim() ||
                updateSkill.isPending
              }
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5">
      <div className="flex items-start gap-3">
        {/* Content */}
        <div className="min-w-0 flex-1">
          <button
            onClick={() => setViewOpen(true)}
            className="text-left text-sm font-medium leading-snug text-foreground hover:text-brain-accent"
          >
            {skill.name}
          </button>
          {skill.content.trim().length > 0 && (
            <p className="mt-0.5 text-xs leading-snug text-[#62627a] whitespace-pre-wrap break-words">
              {preview(skill.content)}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] font-medium text-[#8585a0]">
              {skill.type}
            </span>
            {skill.project.map((p) => (
              <span
                key={p}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: `${projectColor(p)}20`, color: projectColor(p) }}
              >
                {p}
              </span>
            ))}
            {skill.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#8585a0]"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#62627a] hover:text-foreground"
                  onClick={() => setViewOpen(true)}
                  aria-label="View"
                />
              }
            >
              <Eye className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">View.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#62627a] hover:text-foreground"
                  onClick={openEdit}
                  aria-label="Edit"
                />
              }
            >
              <Pencil className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Edit.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#62627a] hover:text-red-400"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete"
                />
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Delete.</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* View dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl">
          <div className="flex max-h-[80vh] flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="break-words">{skill.name}</DialogTitle>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] font-medium text-[#8585a0]">
                    {skill.type}
                  </span>
                  {skill.project.map((p) => (
                    <span
                      key={p}
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ backgroundColor: `${projectColor(p)}20`, color: projectColor(p) }}
                    >
                      {p}
                    </span>
                  ))}
                  {skill.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#8585a0]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-[#62627a] hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                }
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded bg-brain-surface px-3 py-2">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80 font-sans">
                {skill.content}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col gap-3">
            <DialogTitle>Delete skill?</DialogTitle>
            <DialogDescription>
              This will permanently delete “{skill.name}”. This cannot be undone.
            </DialogDescription>
            {deleteSkill.isError && (
              <p className="text-xs text-red-400">
                {deleteSkill.error instanceof Error
                  ? deleteSkill.error.message
                  : 'Failed to delete.'}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <DialogClose
                render={
                  <Button
                    size="xs"
                    variant="ghost"
                    className="gap-1 text-[#62627a] hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                }
              />
              <Button
                size="xs"
                variant="ghost"
                className={cn('gap-1 text-red-400 hover:text-red-300')}
                onClick={handleConfirmDelete}
                disabled={deleteSkill.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
