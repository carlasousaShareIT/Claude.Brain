import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useExperiments(status?: string, project?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['experiments', status ?? '', project ?? ''],
    queryFn: () => api.getExperiments({ status, project }),
  });

  const createExperiment = useMutation({
    mutationFn: api.createExperiment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });

  const updateExperiment = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; hypothesis?: string; status?: string; conclusion?: string; project?: string[] }) =>
      api.updateExperiment(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });

  const addObservation = useMutation({
    mutationFn: ({ experimentId, ...body }: { experimentId: string; text: string; sentiment?: string; sessionId?: string; source?: string }) =>
      api.addObservation(experimentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });

  const deleteExperiment = useMutation({
    mutationFn: api.deleteExperiment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });

  return {
    ...query,
    createExperiment,
    updateExperiment,
    addObservation,
    deleteExperiment,
  } as const;
}
