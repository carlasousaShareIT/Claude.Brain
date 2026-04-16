import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SectionName as _SectionName } from '@/lib/types';
import { api } from '@/lib/api';

export function useBrain(project?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['brain', project ?? ''],
    queryFn: () => api.getBrain(project),
  });

  const postMemory = useMutation({
    mutationFn: api.postMemory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  const autoAdd = useMutation({
    mutationFn: api.autoAdd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  const setConfidence = useMutation({
    mutationFn: api.setConfidence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  const searchMutation = useMutation({
    mutationFn: ({ q, project: p }: { q: string; project?: string }) => api.search(q, p),
  });

  const retag = useMutation({
    mutationFn: api.retag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain'] });
    },
  });

  const checkConflicts = useMutation({
    mutationFn: api.checkConflicts,
  });

  const diff = useMutation({
    mutationFn: api.diff,
  });

  return {
    ...query,
    postMemory,
    autoAdd,
    setConfidence,
    search: searchMutation,
    retag,
    checkConflicts,
    diff,
  } as const;
}
