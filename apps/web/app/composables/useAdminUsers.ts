import { useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { readUsersEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { adminControllerListUsers } from '~~/src/api/admin/admin'

export function useAdminUsers(
  page: MaybeRefOrGetter<number> = 1,
  limit: MaybeRefOrGetter<number> = 20,
) {
  return useQuery({
    queryKey: computed(() => adminQueryKeys.users(toValue(page))),
    queryFn: async () =>
      readUsersEnvelope(
        await adminControllerListUsers({ page: toValue(page), limit: toValue(limit) }),
      ),
  })
}
