import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useSessionsHealth(limit?: number) {
  return useQuery({
    queryKey: ['sessions-health', limit],
    queryFn: () => api.getSessionsHealth(limit),
  })
}

export function useSessionHealth(sessionId: string | null) {
  return useQuery({
    queryKey: ['session-health', sessionId],
    queryFn: () => api.getSessionHealth(sessionId!),
    enabled: !!sessionId,
  })
}
