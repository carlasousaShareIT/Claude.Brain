import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProjects() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const addProject = useMutation({
    mutationFn: api.addProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
    },
  });

  const removeProject = useMutation({
    mutationFn: api.removeProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
    },
  });

  const closeProject = useMutation({
    mutationFn: api.closeProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const reopenProject = useMutation({
    mutationFn: api.reopenProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    ...query,
    addProject,
    removeProject,
    closeProject,
    reopenProject,
  } as const;
}
