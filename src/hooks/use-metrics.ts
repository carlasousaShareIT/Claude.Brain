import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMetrics(project?: string) {
  return useQuery({
    queryKey: ['metrics', project ?? ''],
    queryFn: () => api.getMetrics(project),
  });
}
