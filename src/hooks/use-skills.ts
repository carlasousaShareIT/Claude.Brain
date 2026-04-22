import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSkills(project?: string, type?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['skills', project ?? '', type ?? ''],
    queryFn: () => api.listSkills({ project, type }),
  });

  const createSkill = useMutation({
    mutationFn: api.createSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });

  const updateSkill = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; type?: string; content?: string; project?: string[]; tags?: string[] }) =>
      api.updateSkill(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });

  const deleteSkill = useMutation({
    mutationFn: api.deleteSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });

  return {
    ...query,
    createSkill,
    updateSkill,
    deleteSkill,
  } as const;
}
