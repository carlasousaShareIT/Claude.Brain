import { useCallback, useMemo, useState } from 'react'
import { CalendarClock, CheckCheck, Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReminders } from '@/hooks/use-reminders'
import { useProjects } from '@/hooks/use-projects'
import { ReminderCard } from './reminder-card'
import type { Reminder } from '@/lib/types'

type StatusFilter = 'pending' | 'done' | 'all'
type SortKey = 'priority' | 'due' | 'created'
type DueDateFilter = 'all' | 'overdue' | 'today' | 'week' | 'no-date'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
]

const DUE_FILTERS: { key: DueDateFilter; label: string }[] = [
  { key: 'all', label: 'All dates' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'no-date', label: 'No date' },
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due date' },
  { key: 'created', label: 'Created' },
]

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 }

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function endOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? 0 : 7 - day
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  return endOfDay(end)
}

function matchesDueDateFilter(r: Reminder, filter: DueDateFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'no-date') return !r.dueDate
  if (!r.dueDate) return false
  const due = new Date(r.dueDate)
  const now = new Date()
  if (filter === 'overdue') return due < startOfDay(now)
  if (filter === 'today') return due >= startOfDay(now) && due <= endOfDay(now)
  if (filter === 'week') return due >= startOfDay(now) && due <= endOfWeek(now)
  return true
}

function sortReminders(list: Reminder[], sortKey: SortKey): Reminder[] {
  return [...list].sort((a, b) => {
    if (sortKey === 'priority') {
      const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (diff !== 0) return diff
      // secondary: due date ascending (nulls last)
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    }
    if (sortKey === 'due') {
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    }
    // created — newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function RemindersView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [addText, setAddText] = useState('')
  const [addPriority, setAddPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [addDueDate, setAddDueDate] = useState('')
  const [addProject, setAddProject] = useState<string>('')

  const { data: reminders, updateReminder, deleteReminder, createReminder } = useReminders(
    statusFilter === 'all' ? undefined : statusFilter,
  )
  const { data: projects } = useProjects()

  const allReminders = reminders ?? []

  // Counts for header badges.
  const overdueCount = useMemo(
    () => allReminders.filter((r) => r.status === 'pending' && r.dueDate && new Date(r.dueDate) < startOfDay(new Date())).length,
    [allReminders],
  )
  const pendingCount = useMemo(
    () => allReminders.filter((r) => r.status === 'pending').length,
    [allReminders],
  )

  // Unique projects across reminders for the project filter.
  const reminderProjects = useMemo(() => {
    const set = new Set<string>()
    allReminders.forEach((r) => r.project.forEach((p) => set.add(p)))
    return Array.from(set).sort()
  }, [allReminders])

  // Apply client-side filters.
  const filtered = useMemo(() => {
    let list = allReminders
    if (dueDateFilter !== 'all') {
      list = list.filter((r) => matchesDueDateFilter(r, dueDateFilter))
    }
    if (projectFilter !== 'all') {
      list = list.filter((r) => r.project.includes(projectFilter))
    }
    return list
  }, [allReminders, dueDateFilter, projectFilter])

  const pending = useMemo(() => sortReminders(filtered.filter((r) => r.status === 'pending'), sortKey), [filtered, sortKey])
  const done = useMemo(() => sortReminders(filtered.filter((r) => r.status === 'done'), sortKey), [filtered, sortKey])

  const handleMarkDone = useCallback(
    (id: string) => updateReminder.mutate({ id, status: 'done' }),
    [updateReminder],
  )

  const handleSnooze = useCallback(
    (id: string) => {
      const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      updateReminder.mutate({ id, status: 'snoozed', snoozedUntil })
    },
    [updateReminder],
  )

  const handleDelete = useCallback(
    (id: string) => deleteReminder.mutate(id),
    [deleteReminder],
  )

  const handleUpdateDueDate = useCallback(
    (id: string, dueDate: string | null) => updateReminder.mutate({ id, dueDate }),
    [updateReminder],
  )

  const resetAddForm = useCallback(() => {
    setAddText('')
    setAddPriority('normal')
    setAddDueDate('')
    setAddProject('')
    setShowAdd(false)
  }, [])

  const handleAddSubmit = useCallback(() => {
    const text = addText.trim()
    if (!text) return
    createReminder.mutate(
      {
        text,
        priority: addPriority,
        ...(addDueDate ? { dueDate: new Date(addDueDate + 'T00:00:00').toISOString() } : {}),
        ...(addProject ? { project: [addProject] } : {}),
      },
      { onSuccess: resetAddForm },
    )
  }, [addText, addPriority, addDueDate, addProject, createReminder, resetAddForm])

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleAddSubmit()
      if (e.key === 'Escape') resetAddForm()
    },
    [handleAddSubmit, resetAddForm],
  )

  const handleMarkAllDone = useCallback(() => {
    pending.forEach((r) => updateReminder.mutate({ id: r.id, status: 'done' }))
  }, [pending, updateReminder])

  const showDone = statusFilter === 'done' || statusFilter === 'all'

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="shrink-0 border-b border-white/5 px-4 py-2">
        {/* Top row: status filters + counts + add button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Status filter toggles */}
            <div className="flex items-center gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    statusFilter === f.key
                      ? 'bg-brain-surface text-foreground'
                      : 'text-[#62627a] hover:text-foreground/80',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Count badges */}
            {overdueCount > 0 && (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                {overdueCount} overdue
              </span>
            )}
            {pendingCount > 0 && (
              <span className="rounded-full bg-brain-accent/20 px-2 py-0.5 text-[10px] font-medium text-brain-accent">
                {pendingCount} pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mark all done */}
            {pending.length > 0 && statusFilter !== 'done' && (
              <Button
                variant="ghost"
                size="xs"
                className="gap-1 text-[#62627a] hover:text-brain-green"
                onClick={handleMarkAllDone}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                All done
              </Button>
            )}
            {/* Add button */}
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
        </div>

        {/* Second row: due date filter, project filter, sort */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Due date filter */}
          <div className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3 text-[#62627a]" />
            {DUE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setDueDateFilter(f.key)}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                  dueDateFilter === f.key
                    ? 'bg-brain-surface text-foreground'
                    : 'text-[#62627a] hover:text-foreground/80',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-[#62627a]/30">|</span>

          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] text-[#62627a] focus:outline-none"
          >
            <option value="all">All projects</option>
            {reminderProjects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <span className="text-[#62627a]/30">|</span>

          {/* Sort control */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#62627a]">Sort:</span>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                  sortKey === s.key
                    ? 'bg-brain-surface text-foreground'
                    : 'text-[#62627a] hover:text-foreground/80',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 px-4 pt-3 pb-4">
          {/* Expandable add form */}
          {showAdd && (
            <div
              className="space-y-2 rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) resetAddForm()
              }}
            >
              <input
                autoFocus
                type="text"
                placeholder="New reminder…"
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={addPriority}
                  onChange={(e) => setAddPriority(e.target.value as 'low' | 'normal' | 'high')}
                  className="rounded bg-brain-surface px-1.5 py-0.5 text-xs text-[#62627a] focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
                <input
                  type="date"
                  value={addDueDate}
                  onChange={(e) => setAddDueDate(e.target.value)}
                  className="rounded bg-brain-surface px-1.5 py-0.5 text-xs text-[#62627a] focus:outline-none [color-scheme:dark]"
                />
                <select
                  value={addProject}
                  onChange={(e) => setAddProject(e.target.value)}
                  className="rounded bg-brain-surface px-1.5 py-0.5 text-xs text-[#62627a] focus:outline-none"
                >
                  <option value="">No project</option>
                  {(projects ?? []).filter((p) => p.status === 'active').map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto text-brain-accent hover:text-brain-accent/80"
                  onClick={handleAddSubmit}
                  disabled={!addText.trim() || createReminder.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showAdd && pending.length === 0 && (!showDone || done.length === 0) && (
            <p className="py-8 text-center text-xs text-[#62627a]">No reminders. Enjoy the calm.</p>
          )}

          {/* Pending reminders */}
          {pending.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onMarkDone={handleMarkDone}
              onSnooze={handleSnooze}
              onDelete={handleDelete}
              onUpdateDueDate={handleUpdateDueDate}
            />
          ))}

          {/* Done reminders */}
          {showDone && done.length > 0 && (
            <div className="space-y-2">
              {pending.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#62627a]">
                    Done
                  </span>
                  <span className="text-[10px] text-[#62627a]">({done.length})</span>
                </div>
              )}
              {done.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onMarkDone={handleMarkDone}
                  onSnooze={handleSnooze}
                  onDelete={handleDelete}
                  onUpdateDueDate={handleUpdateDueDate}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
