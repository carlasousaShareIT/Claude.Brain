import { useEffect, useRef } from 'react'

interface AnalyticsComplianceSession {
  sessionId: string
  label: string | null
  project: string | null
  date: string | null
  score: number
  gates: Record<string, 'pass' | 'fail' | 'not_applicable'>
}

interface ComplianceData {
  rates: Record<string, { passed: number; total: number; rate: number }>
  worstGate: string | null
  sessions: AnalyticsComplianceSession[]
}

const GATE_LABELS: Record<string, string> = {
  brain_query: 'Brain Query',
  agent_profile: 'Agent Profile',
  reviewer: 'Reviewer',
}

function gateStatusColor(status: 'pass' | 'fail' | 'not_applicable'): string {
  if (status === 'pass') return '#34d399'
  if (status === 'fail') return '#f87171'
  return '#62627a'
}

function scoreColor(rate: number): string {
  if (rate >= 0.8) return '#34d399'
  if (rate >= 0.5) return '#fbbf24'
  return '#f87171'
}

interface SparklineProps {
  sessions: AnalyticsComplianceSession[]
}

function ComplianceSparkline({ sessions }: SparklineProps) {
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

    ctx.clearRect(0, 0, w, h)

    if (sessions.length === 0) return

    const padding = 4
    const scores = sessions.map((s) => s.score * 100)
    const minScore = 0
    const maxScore = 100

    const toX = (i: number) =>
      padding + (i / Math.max(sessions.length - 1, 1)) * (w - padding * 2)
    const toY = (score: number) =>
      h - padding - ((score - minScore) / (maxScore - minScore)) * (h - padding * 2)

    // Fill area below the line.
    ctx.beginPath()
    ctx.moveTo(toX(0), h - padding)
    scores.forEach((score, i) => {
      ctx.lineTo(toX(i), toY(score))
    })
    ctx.lineTo(toX(scores.length - 1), h - padding)
    ctx.closePath()
    ctx.fillStyle = 'rgba(167, 139, 250, 0.10)'
    ctx.fill()

    // Draw line.
    ctx.beginPath()
    scores.forEach((score, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(score))
      else ctx.lineTo(toX(i), toY(score))
    })
    ctx.strokeStyle = '#a78bfa'
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Draw dots.
    scores.forEach((score, i) => {
      ctx.beginPath()
      ctx.arc(toX(i), toY(score), 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#a78bfa'
      ctx.fill()
    })
  }, [sessions])

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full"
      style={{ display: 'block' }}
    />
  )
}

export function ComplianceScorecard({ data }: { data: ComplianceData }) {
  const rateEntries = Object.entries(data.rates)

  const totalPassed = rateEntries.reduce((sum, [, v]) => sum + v.passed, 0)
  const totalApplicable = rateEntries.reduce((sum, [, v]) => sum + v.total, 0)
  const overallRate = totalApplicable > 0 ? totalPassed / totalApplicable : 0

  const overallPct = Math.round(overallRate * 100)
  const color = scoreColor(overallRate)

  const gateKeys = ['brain_query', 'agent_profile', 'reviewer']

  return (
    <div className="space-y-4">
      {/* Overall percentage */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-4xl font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {overallPct}%
        </span>
        <span className="text-xs text-muted-foreground">overall compliance</span>
      </div>

      {/* Gate rows */}
      <div className="space-y-2.5">
        {gateKeys.map((gate) => {
          const info = data.rates[gate]
          if (!info) return null
          const pct = Math.round(info.rate * 100)
          const barColor = scoreColor(info.rate)
          const label = GATE_LABELS[gate] ?? gate

          return (
            <div key={gate} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {info.passed}/{info.total} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-brain-surface">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Sparkline */}
      {data.sessions.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Score over time
          </p>
          <ComplianceSparkline sessions={data.sessions} />
        </div>
      )}

      {/* Session list */}
      {data.sessions.length > 0 && (
        <div
          className="max-h-[200px] overflow-y-auto space-y-0.5 rounded-md"
          style={{ scrollbarWidth: 'thin' }}
        >
          {data.sessions.map((session) => {
            const gateEntries = Object.entries(session.gates)
            const dateStr = session.date
              ? new Date(session.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'

            return (
              <div
                key={session.sessionId}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-[10px] hover:bg-brain-hover/30"
              >
                <span className="w-10 shrink-0 text-muted-foreground">{dateStr}</span>
                <span className="min-w-0 flex-1 truncate text-foreground/80">
                  {session.label ?? session.sessionId.slice(0, 8)}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {gateEntries.map(([gate, status]) => (
                    <span
                      key={gate}
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: gateStatusColor(status) }}
                      title={`${GATE_LABELS[gate] ?? gate}: ${status}`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data.sessions.length === 0 && (
        <p className="text-xs text-muted-foreground">No session data yet.</p>
      )}
    </div>
  )
}
