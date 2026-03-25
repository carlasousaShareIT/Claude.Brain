import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SectionName } from '@/lib/types'

export function useProfiles() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['profiles'],
    queryFn: api.getProfiles,
  })

  const createProfile = useMutation({
    mutationFn: api.createProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const updateProfile = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; taskType?: string; sections?: SectionName[]; tags?: string[]; project?: string | null }) =>
      api.updateProfile(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const deleteProfile = useMutation({
    mutationFn: api.deleteProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  return { ...query, createProfile, updateProfile, deleteProfile }
}
