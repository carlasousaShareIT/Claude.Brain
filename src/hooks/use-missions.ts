import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMissions(status?: string, project?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['missions', status ?? '', project ?? ''],
    queryFn: () => api.getMissions({ status, project }),
  });

  const createMission = useMutation({
    mutationFn: api.createMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const updateMission = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; status?: string }) =>
      api.updateMission(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const deleteMission = useMutation({
    mutationFn: api.deleteMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const addTasks = useMutation({
    mutationFn: ({
      missionId,
      tasks,
    }: {
      missionId: string;
      tasks: Array<{ description: string }>;
    }) => api.addTasks(missionId, { tasks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({
      missionId,
      taskId,
      ...body
    }: {
      missionId: string;
      taskId: string;
      status?: string;
      assignedAgent?: string;
      sessionId?: string;
      output?: string;
      blockers?: string[];
    }) => api.updateTask(missionId, taskId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['mission', variables.missionId] });
    },
  });

  return {
    ...query,
    createMission,
    updateMission,
    deleteMission,
    addTasks,
    updateTask,
  } as const;
}

export function useResumable(project?: string) {
  return useQuery({
    queryKey: ['missions', 'resumable', project ?? ''],
    queryFn: () => api.getResumable(project),
  });
}
