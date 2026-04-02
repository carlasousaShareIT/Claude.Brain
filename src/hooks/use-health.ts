import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useHealth() {
  return useMutation({
    mutationFn: (repoPath: string) => api.checkHealth({ repoPath }),
  })
}

export function useAutoHealth(enabled: boolean) {
  return useQuery({
    queryKey: ['health', 'auto'],
    queryFn: () => api.checkHealth({ repoPath: '' }),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
