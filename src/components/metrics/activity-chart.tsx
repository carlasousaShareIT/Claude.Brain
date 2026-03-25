import { useEffect, useRef } from 'react'

interface ActivityChartProps {
  activityByDay: Record<string, number>
}

/** Canvas sparkline showing daily activity for the last 30 days. */
export function ActivityChart({ activityByDay }: ActivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Build sorted array of last 30 days.
    const today = new Date()
    const days: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      days.push({ date: iso, count: activityByDay[iso] ?? 0 })
    }

    const todayISO = today.toISOString().slice(0, 10)
    const maxCount = Math.max(...days.map((d) => d.count), 1)

    // Size canvas to container.
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = 2
    const barGap = 2
    const barWidth = (w - padding * 2 - barGap * (days.length - 1)) / days.length

    ctx.clearRect(0, 0, w, h)

    days.forEach((day, i) => {
      const barHeight = Math.max((day.count / maxCount) * (h - padding * 2), day.count > 0 ? 2 : 0)
      const x = padding + i * (barWidth + barGap)
      const y = h - padding - barHeight

      const isToday = day.date === todayISO
      ctx.fillStyle = isToday ? '#c4b5fd' : '#a78bfa'
      ctx.globalAlpha = isToday ? 1 : 0.7

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 1)
      ctx.fill()
    })

    ctx.globalAlpha = 1
  }, [activityByDay])

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full"
      style={{ display: 'block' }}
    />
  )
}
