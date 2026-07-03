import { useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { readQuarantineDetailEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { quarantineAdminControllerDetail } from '~~/src/api/quarantine-admin/quarantine-admin'

export function useAdminQuarantineDetail(id: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => adminQueryKeys.quarantineDetail(toValue(id) ?? '')),
    queryFn: async () =>
      readQuarantineDetailEnvelope(await quarantineAdminControllerDetail(toValue(id) as string)),
    enabled: computed(() => Boolean(toValue(id))),
  })
}
