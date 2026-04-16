import { AlertCircle } from 'lucide-react'

interface QueryErrorProps {
  message?: string
  onRetry?: () => void
}

export function QueryError({ message = 'Failed to load data.', onRetry }: QueryErrorProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-center">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <p className="text-sm text-red-400">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
