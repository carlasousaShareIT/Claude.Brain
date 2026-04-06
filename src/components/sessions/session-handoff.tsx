import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, AlertTriangle, GitBranch, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { SessionHandoff } from '@/lib/types'

interface HandoffSectionProps {
  label: string
  items: string[]
  icon: React.ReactNode
  accentClass: string
}

function HandoffSection({ label, items, icon, accentClass }: HandoffSectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 py-0.5 text-left"
        onClick={() => setOpen(!open)}
      >
        {open
          ? <ChevronDown className="h-2.5 w-2.5 shrink-0 text-[#62627a]" />
          : <ChevronRight className="h-2.5 w-2.5 shrink-0 text-[#62627a]" />
        }
        <span className={cn('h-3 w-3 shrink-0', accentClass)}>{icon}</span>
        <span className="text-[10px] font-medium text-foreground/70">
          {label}
        </span>
        <span className="text-[10px] text-[#62627a]">({items.length})</span>
      </button>
      {open && (
        <div className="ml-[18px] space-y-0.5 pb-1">
          {items.map((item, i) => (
            <p key={i} className="text-xs leading-tight text-foreground/80">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function SessionHandoffDisplay({ handoff }: { handoff: SessionHandoff }) {
  const sections: Array<{
    key: keyof SessionHandoff
    label: string
    icon: React.ReactNode
    accentClass: string
  }> = [
    { key: 'done', label: 'Done', icon: <CheckCircle2 className="h-3 w-3" />, accentClass: 'text-brain-green' },
    { key: 'remaining', label: 'Remaining', icon: <Circle className="h-3 w-3" />, accentClass: 'text-brain-cyan' },
    { key: 'blocked', label: 'Blocked', icon: <AlertTriangle className="h-3 w-3" />, accentClass: 'text-brain-amber' },
    { key: 'decisions', label: 'Decisions', icon: <GitBranch className="h-3 w-3" />, accentClass: 'text-brain-purple' },
  ]

  const visibleSections = sections.filter((s) => handoff[s.key]?.length > 0)
  if (visibleSections.length === 0) return null

  return (
    <div className="rounded-md bg-brain-base px-3 py-2 ring-1 ring-white/5">
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[#62627a]">
        Session handoff
      </p>
      <div className="space-y-0.5">
        {visibleSections.map((s) => (
          <HandoffSection
            key={s.key}
            label={s.label}
            items={handoff[s.key]}
            icon={s.icon}
            accentClass={s.accentClass}
          />
        ))}
      </div>
    </div>
  )
}

export function SessionHandoffSection({ sessionId }: { sessionId: string }) {
  const { data } = useQuery({
    queryKey: ['session-lifecycle', sessionId],
    queryFn: () => api.getSessionLifecycle(sessionId),
  })

  if (!data?.handoff) return null

  return <SessionHandoffDisplay handoff={data.handoff} />
}
