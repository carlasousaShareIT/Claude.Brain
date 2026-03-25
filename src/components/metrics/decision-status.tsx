interface DecisionStatusProps {
  byStatus: { open: number; resolved: number }
}

export function DecisionStatus({ byStatus }: DecisionStatusProps) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="text-xs text-foreground">Open</span>
        <span className="text-sm tabular-nums font-medium text-foreground">
          {byStatus.open}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="text-xs text-foreground">Resolved</span>
        <span className="text-sm tabular-nums font-medium text-foreground">
          {byStatus.resolved}
        </span>
      </div>
    </div>
  )
}
