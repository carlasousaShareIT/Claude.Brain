import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReminders } from '@/hooks/use-reminders'
import { ReminderCard } from './reminder-card'

type StatusFilter = 'pending' | 'done' | 'all'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
]

export function RemindersView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [showAdd, setShowAdd] = useState(false)
  const [addText, setAddText] = useState('')
  const [addPriority, setAddPriority] = useState<'low' | 'normal' | 'high'>('normal')

  const { data: reminders, updateReminder, deleteReminder, createReminder } = useReminders(
    statusFilter === 'all' ? undefined : statusFilter,
  )

  const pending = (reminders ?? []).filter((r) => r.status === 'pending')
  const done = (reminders ?? []).filter((r) => r.status === 'done')

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

  const handleAddSubmit = useCallback(() => {
    const text = addText.trim()
    if (!text) return
    createReminder.mutate(
      { text, priority: addPriority },
      {
        onSuccess: () => {
          setAddText('')
          setAddPriority('normal')
          setShowAdd(false)
        },
      },
    )
  }, [addText, addPriority, createReminder])

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleAddSubmit()
      if (e.key === 'Escape') {
        setShowAdd(false)
        setAddText('')
        setAddPriority('normal')
      }
    },
    [handleAddSubmit],
  )

  const showDone = statusFilter === 'done' || statusFilter === 'all'

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
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

      <ScrollArea className="flex-1">
        <div className="space-y-2 px-4 pt-3 pb-4">
          {/* Inline add form */}
          {showAdd && (
            <div
              className="flex items-center gap-2 rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setShowAdd(false)
                  setAddText('')
                  setAddPriority('normal')
                }
              }}
            >
              <input
                autoFocus
                type="text"
                placeholder="New reminder…"
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-[#62627a] focus:outline-none"
              />
              <select
                value={addPriority}
                onChange={(e) => setAddPriority(e.target.value as 'low' | 'normal' | 'high')}
                className="rounded bg-brain-surface px-1.5 py-0.5 text-xs text-[#62627a] focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
              <Button
                size="xs"
                variant="ghost"
                className="text-brain-accent hover:text-brain-accent/80"
                onClick={handleAddSubmit}
                disabled={!addText.trim() || createReminder.isPending}
              >
                Save
              </Button>
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
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
