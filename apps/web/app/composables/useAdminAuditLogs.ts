import { useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { readAuditLogsEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { adminControllerListAuditLogs } from '~~/src/api/admin/admin'

export function useAdminAuditLogs(
  page: MaybeRefOrGetter<number> = 1,
  limit: MaybeRefOrGetter<number> = 20,
) {
  return useQuery({
    queryKey: computed(() => adminQueryKeys.auditLogs(toValue(page))),
    queryFn: async () =>
      readAuditLogsEnvelope(
        await adminControllerListAuditLogs({ page: toValue(page), limit: toValue(limit) }),
      ),
  })
}
