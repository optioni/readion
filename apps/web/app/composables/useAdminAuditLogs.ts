import { useQuery } from '@tanstack/vue-query'
import { readAuditLogsEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { adminControllerListAuditLogs } from '~~/src/api/admin/admin'

export function useAdminAuditLogs() {
  return useQuery({
    queryKey: adminQueryKeys.auditLogs(),
    queryFn: async () => readAuditLogsEnvelope(await adminControllerListAuditLogs()),
  })
}
