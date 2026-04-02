import { useCallback, useState } from 'react'
import { Calendar, Clock, Trash2 } from 'lucide-react'
import { cn, projectColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Reminder } from '@/lib/types'

interface ReminderCardProps {
  reminder: Reminder
  onMarkDone: (id: string) => void
  onSnooze: (id: string) => void
  onDelete: (id: string) => void
  onUpdateDueDate: (id: string, dueDate: string | null) => void
}

function formatDueDate(dueDate: string): { label: string; overdue: boolean } {
  const due = new Date(dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const overdue = due < today
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { label, overdue }
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ReminderCard({ reminder, onMarkDone, onSnooze, onDelete, onUpdateDueDate }: ReminderCardProps) {
  const isDone = reminder.status === 'done'
  const due = reminder.dueDate ? formatDueDate(reminder.dueDate) : null
  const [editingDate, setEditingDate] = useState(false)

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      if (val) {
        onUpdateDueDate(reminder.id, new Date(val + 'T00:00:00').toISOString())
      } else {
        onUpdateDueDate(reminder.id, null)
      }
      setEditingDate(false)
    },
    [reminder.id, onUpdateDueDate],
  )

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg bg-brain-raised px-3 py-2.5 ring-1 ring-white/5 transition-opacity',
        isDone && 'opacity-50',
      )}
    >
      {/* Checkbox circle */}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={() => !isDone && onMarkDone(reminder.id)}
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                isDone
                  ? 'border-brain-green bg-brain-green/20'
                  : 'border-white/20 hover:border-brain-green/60',
              )}
              aria-label={isDone ? 'Done' : 'Mark done'}
              disabled={isDone}
            />
          }
        >
          {isDone ? (
            <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-brain-green" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </TooltipTrigger>
        <TooltipContent side="top">{isDone ? 'Done.' : 'Mark done.'}</TooltipContent>
      </Tooltip>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-snug',
            isDone ? 'text-[#62627a] line-through' : 'text-foreground',
          )}
        >
          {reminder.text}
        </p>

        {/* Meta row */}
        {(reminder.priority !== 'normal' || due || editingDate || reminder.project.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {reminder.priority === 'high' && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400">
                high
              </span>
            )}
            {reminder.priority === 'low' && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400">
                low
              </span>
            )}
            {editingDate ? (
              <input
                autoFocus
                type="date"
                defaultValue={reminder.dueDate ? toDateInputValue(reminder.dueDate) : ''}
                onChange={handleDateChange}
                onBlur={() => setEditingDate(false)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingDate(false) }}
                className="rounded bg-brain-surface px-1.5 py-0.5 text-[10px] text-[#62627a] focus:outline-none [color-scheme:dark]"
              />
            ) : due ? (
              <button
                onClick={() => !isDone && setEditingDate(true)}
                className={cn(
                  'text-[10px] transition-colors',
                  due.overdue ? 'font-medium text-red-400' : 'text-[#62627a]',
                  !isDone && 'hover:text-foreground/80 cursor-pointer',
                )}
                title="Click to edit due date."
              >
                {due.overdue ? 'Overdue' : due.label}
              </button>
            ) : null}
            {reminder.project.map((p) => (
              <span
                key={p}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: `${projectColor(p)}20`, color: projectColor(p) }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons — visible on hover */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!isDone && !due && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#62627a] hover:text-foreground"
                  onClick={() => setEditingDate(true)}
                  aria-label="Set due date"
                />
              }
            >
              <Calendar className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Set due date.</TooltipContent>
          </Tooltip>
        )}
        {!isDone && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#62627a] hover:text-foreground"
                  onClick={() => onSnooze(reminder.id)}
                  aria-label="Snooze"
                />
              }
            >
              <Clock className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">Snooze 1 hour.</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[#62627a] hover:text-red-400"
                onClick={() => onDelete(reminder.id)}
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
  )
}
