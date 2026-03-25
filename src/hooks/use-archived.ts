import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useArchived() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['archived'],
    queryFn: api.getArchived,
  });

  const archive = useMutation({
    mutationFn: api.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      queryClient.invalidateQueries({ queryKey: ['archived'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  const unarchive = useMutation({
    mutationFn: api.unarchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      queryClient.invalidateQueries({ queryKey: ['archived'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  return {
    ...query,
    archive,
    unarchive,
  } as const;
}
