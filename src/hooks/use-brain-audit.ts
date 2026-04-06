import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useBrainAudit() {
  const queryClient = useQueryClient()

  const latestAudit = useQuery({
    queryKey: ['audit-reports', 'latest'],
    queryFn: () => api.getLatestAudit(),
    retry: false,  // 404 is normal when no audits exist yet
  })

  const auditReports = useQuery({
    queryKey: ['audit-reports'],
    queryFn: () => api.getAuditReports(),
  })

  const runAudit = useMutation({
    mutationFn: api.runAudit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-reports'] })
    },
  })

  const dismissFinding = useMutation({
    mutationFn: api.dismissFinding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-reports'] })
    },
  })

  const promoteDecision = useMutation({
    mutationFn: api.promoteDecision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-reports'] })
      queryClient.invalidateQueries({ queryKey: ['brain'] })
    },
  })

  const mergeEntries = useMutation({
    mutationFn: api.mergeEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-reports'] })
      queryClient.invalidateQueries({ queryKey: ['brain'] })
    },
  })

  return {
    latestAudit,
    auditReports,
    runAudit,
    dismissFinding,
    promoteDecision,
    mergeEntries,
  } as const
}
