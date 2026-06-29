import { useQuery } from '@tanstack/vue-query'
import { readUsersEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { adminControllerListUsers } from '~~/src/api/admin/admin'

export function useAdminUsers() {
  return useQuery({
    queryKey: adminQueryKeys.users(),
    queryFn: async () => readUsersEnvelope(await adminControllerListUsers()),
  })
}
