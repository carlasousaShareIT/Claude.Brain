import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAnnotations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['annotations'],
    queryFn: api.getAnnotations,
  });

  const annotate = useMutation({
    mutationFn: api.annotate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
    },
  });

  const removeAnnotation = useMutation({
    mutationFn: api.removeAnnotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
    },
  });

  return {
    ...query,
    annotate,
    removeAnnotation,
  } as const;
}
