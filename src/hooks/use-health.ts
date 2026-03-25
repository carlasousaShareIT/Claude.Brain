import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useHealth() {
  return useMutation({
    mutationFn: (repoPath: string) => api.checkHealth({ repoPath }),
  })
}
