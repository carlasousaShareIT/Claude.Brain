import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AnalyticsViolationSession {
  sessionId: string
  label: string | null
  spiralExplorer: number
  stuck: number
  total: number
}

interface ViolationsData {
  sessions: AnalyticsViolationSession[]
  totals: Record<string, number>
}

function violationBarColor(session: AnalyticsViolationSession): string {
  if (session.total === 0) return '#62627a'
  if (session.stuck > 0) return '#f87171'
  return '#fbbf24'
}

interface ViolationBarChartProps {
  sessions: AnalyticsViolationSession[]
}

function ViolationBarChart({ sessions }: ViolationBarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = 2
    const barGap = 2

    ctx.clearRect(0, 0, w, h)

    if (sessions.length === 0) return

    const maxTotal = Math.max(...sessions.map((s) => s.total), 1)
    const barWidth = (w - padding * 2 - barGap * (sessions.length - 1)) / sessions.length

    sessions.forEach((session, i) => {
      const barHeight = Math.max(
        (session.total / maxTotal) * (h - padding * 2),
        session.total > 0 ? 2 : 0,
      )
      const x = padding + i * (barWidth + barGap)
      const y = h - padding - barHeight

      ctx.fillStyle = violationBarColor(session)
      ctx.globalAlpha = session.total === 0 ? 0.25 : 0.85

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 1)
      ctx.fill()
    })

    ctx.globalAlpha = 1
  }, [sessions])

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full"
      style={{ display: 'block' }}
    />
  )
}

export function ViolationFeed({ data }: { data: ViolationsData }) {
  const totalEntries = Object.entries(data.totals).filter(([key]) => key !== 'total')

  const TYPE_LABELS: Record<string, string> = {
    spiralExplorer: 'Spiral',
    spiral_explorer: 'Spiral',
    stuck: 'Stuck',
  }

  const TYPE_COLORS: Record<string, string> = {
    spiralExplorer: '#fbbf24',
    spiral_explorer: '#fbbf24',
    stuck: '#f87171',
  }

  const sessionsWithViolations = [...data.sessions]
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-2">
        {totalEntries.length === 0 && (
          <span className="text-xs text-muted-foreground">No violations recorded.</span>
        )}
        {totalEntries.map(([type, count]) => {
          const label = TYPE_LABELS[type] ?? type
          const color = TYPE_COLORS[type] ?? '#9d9db5'
          return (
            <span
              key={type}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `${color}20`,
                color,
              }}
            >
              {label}
              <span
                className="ml-0.5 rounded-full px-1 py-px text-[10px] font-bold"
                style={{ backgroundColor: `${color}30` }}
              >
                {count}
              </span>
            </span>
          )
        })}
      </div>

      {/* Bar chart */}
      {data.sessions.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Violations per session
          </p>
          <ViolationBarChart sessions={data.sessions} />
        </div>
      )}

      {/* Scrollable session list */}
      {sessionsWithViolations.length > 0 && (
        <div
          className="max-h-[200px] overflow-y-auto space-y-0.5 rounded-md"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="mb-1 flex items-center gap-2 px-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            <span className="flex-1">Session</span>
            <span className="w-10 text-right" style={{ color: '#fbbf24' }}>Spiral</span>
            <span className="w-8 text-right" style={{ color: '#f87171' }}>Stuck</span>
            <span className="w-8 text-right">Total</span>
          </div>
          {sessionsWithViolations.map((session) => (
            <div
              key={session.sessionId}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-[10px] hover:bg-brain-hover/30"
            >
              <span className="min-w-0 flex-1 truncate text-foreground/80">
                {session.label ?? session.sessionId.slice(0, 8)}
              </span>
              <span
                className={cn(
                  'w-10 shrink-0 text-right tabular-nums',
                  session.spiralExplorer > 0 ? 'text-[#fbbf24]' : 'text-muted-foreground',
                )}
              >
                {session.spiralExplorer}
              </span>
              <span
                className={cn(
                  'w-8 shrink-0 text-right tabular-nums',
                  session.stuck > 0 ? 'text-[#f87171]' : 'text-muted-foreground',
                )}
              >
                {session.stuck}
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums font-medium text-foreground">
                {session.total}
              </span>
            </div>
          ))}
        </div>
      )}

      {sessionsWithViolations.length === 0 && data.sessions.length > 0 && (
        <p className="text-xs text-muted-foreground">No violations in any session.</p>
      )}
    </div>
  )
}
