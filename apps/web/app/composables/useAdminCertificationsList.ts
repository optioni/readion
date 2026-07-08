import { useQuery } from '@tanstack/vue-query'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'

export function useAdminCertificationsList() {
  return useQuery({
    queryKey: ['admin', 'certifications-list'],
    queryFn: async () => (await certificationsControllerList()).data.data,
  })
}
