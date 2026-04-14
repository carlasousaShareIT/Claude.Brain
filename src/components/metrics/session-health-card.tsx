import { useSessionsHealth } from '@/hooks/use-session-health'
import type { GateRate, SessionHealthTrend } from '@/lib/types'
import { cn } from '@/lib/utils'

const GATE_LABELS: Record<string, string> = {
  brain_query: 'Brain query',
  agent_profile: 'Agent context',
  reviewer: 'Reviewer',
}

function scoreColor(rate: number): string {
  if (rate > 0.8) return '#34d399'  // green
  if (rate >= 0.5) return '#fbbf24' // amber
  return '#f87171'                  // red
}

function GateRow({
  gate,
  gateRate,
  isWorst,
}: {
  gate: string
  gateRate: GateRate
  isWorst: boolean
}) {
  const pct = Math.round(gateRate.rate * 100)
  const color = scoreColor(gateRate.rate)

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'w-24 shrink-0 text-xs',
          isWorst ? 'font-medium text-foreground' : 'text-muted-foreground',
        )}
      >
        {GATE_LABELS[gate] ?? gate}
        {isWorst && (
          <span className="ml-1 text-[10px]" style={{ color }}>
            *
          </span>
        )}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-brain-base overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {gateRate.passed}/{gateRate.total}{' '}
        <span style={{ color }}>{pct}%</span>
      </span>
    </div>
  )
}

function Sparkline({ trend }: { trend: SessionHealthTrend[] }) {
  if (trend.length < 2) return null

  const width = 280
  const height = 32
  const padding = 2

  const points = trend.map((t, i) => {
    const x = padding + (i / (trend.length - 1)) * (width - padding * 2)
    const y = height - padding - t.score * (height - padding * 2)
    return `${x},${y}`
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: `${height}px` }}
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SessionHealthCardContent() {
  const { data, isLoading } = useSessionsHealth(20)

  if (isLoading) {
    return (
      <p className="text-xs text-muted-foreground">Loading session health...</p>
    )
  }

  if (!data) {
    return (
      <p className="text-xs text-[#62627a]">No session health data available.</p>
    )
  }

  const rates = data.rates
  const gateKeys = Object.keys(rates) as Array<keyof typeof rates>
  const overallRate =
    gateKeys.length > 0
      ? gateKeys.reduce((sum, k) => sum + rates[k].rate, 0) / gateKeys.length
      : 0
  const overallPct = Math.round(overallRate * 100)
  const color = scoreColor(overallRate)

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-2xl tabular-nums font-semibold"
          style={{ color }}
        >
          {overallPct}%
        </span>
        <span className="text-xs text-muted-foreground">overall compliance</span>
      </div>

      {/* Gate rows */}
      <div className="space-y-2">
        {gateKeys.map((gate) => (
          <GateRow
            key={gate}
            gate={gate}
            gateRate={rates[gate]}
            isWorst={data.worstGate === gate}
          />
        ))}
      </div>

      {/* Sparkline */}
      {data.trend.length >= 2 && (
        <div>
          <Sparkline trend={data.trend} />
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-[#62627a]">
        {data.analyzedSessions} sessions analyzed, avg{' '}
        {data.averageActivitiesPerSession.toFixed(1)} activities/session.
      </p>
    </div>
  )
}
