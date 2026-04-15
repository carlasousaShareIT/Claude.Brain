import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useAnalytics(limit?: number) {
  return useQuery({
    queryKey: ['analytics', limit ?? 30],
    queryFn: () => api.getAnalyticsSummary(limit),
  })
}
