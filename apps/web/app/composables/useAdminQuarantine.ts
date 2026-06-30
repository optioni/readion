import { useQuery } from '@tanstack/vue-query'
import { readQuarantineEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { quarantineAdminControllerList } from '~~/src/api/quarantine-admin/quarantine-admin'

export function useAdminQuarantine() {
  return useQuery({
    queryKey: adminQueryKeys.quarantine(),
    queryFn: async () =>
      readQuarantineEnvelope(await quarantineAdminControllerList({ status: 'pending' })),
  })
}
