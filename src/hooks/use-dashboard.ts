import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDashboard() {
  const missions = useQuery({
    queryKey: ['missions', 'active', ''],
    queryFn: () => api.getMissions({ status: 'active' }),
  })

  const sessions = useQuery({
    queryKey: ['dashboard-sessions'],
    queryFn: () => api.listSessionLifecycles({ limit: 5 }),
    staleTime: 30_000,
  })

  const reminders = useQuery({
    queryKey: ['reminders', 'pending', ''],
    queryFn: () => api.getReminders({ status: 'pending' }),
  })

  const experiments = useQuery({
    queryKey: ['experiments', 'active', ''],
    queryFn: () => api.getExperiments({ status: 'active' }),
  })

  const skills = useQuery({
    queryKey: ['skills', '', ''],
    queryFn: () => api.listSkills(),
  })

  const analytics = useQuery({
    queryKey: ['analytics', 30],
    queryFn: () => api.getAnalyticsSummary(30),
  })

  const metrics = useQuery({
    queryKey: ['metrics', ''],
    queryFn: () => api.getMetrics(),
  })

  const watchers = useQuery({
    queryKey: ['watchers'],
    queryFn: api.getWatchers,
    refetchInterval: 5000,
  })

  const violationStats = useQuery({
    queryKey: ['violation-stats'],
    queryFn: api.getViolationStats,
  })

  return {
    missions,
    sessions,
    reminders,
    experiments,
    skills,
    analytics,
    metrics,
    watchers,
    violationStats,
  }
}
