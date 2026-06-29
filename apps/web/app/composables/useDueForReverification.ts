import { useQuery } from '@tanstack/vue-query'
import { readDueForReverificationEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { certSetupControllerListDueForReverification } from '~~/src/api/cert-setup/cert-setup'

export function useDueForReverification() {
  return useQuery({
    queryKey: adminQueryKeys.dueForReverification(),
    queryFn: async () =>
      readDueForReverificationEnvelope(await certSetupControllerListDueForReverification()),
  })
}
