import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useReminders(status?: string, project?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['reminders', status ?? '', project ?? ''],
    queryFn: () => api.getReminders({ status, project }),
  });

  const createReminder = useMutation({
    mutationFn: api.createReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const updateReminder = useMutation({
    mutationFn: ({ id, ...body }: { id: string; text?: string; status?: string; priority?: string; dueDate?: string; snoozedUntil?: string; project?: string[] }) =>
      api.updateReminder(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const deleteReminder = useMutation({
    mutationFn: api.deleteReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  return {
    ...query,
    createReminder,
    updateReminder,
    deleteReminder,
  } as const;
}
