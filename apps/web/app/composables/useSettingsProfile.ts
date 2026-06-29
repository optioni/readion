import type { UserProfileResponse } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { readProfileEnvelope } from '~/composables/useOnboardingGate'
import { usersControllerGetMe } from '~~/src/api/users/users'

export function useSettingsProfile() {
  return useQuery({
    queryKey: settingsQueryKeys.profile(),
    queryFn: async (): Promise<UserProfileResponse> =>
      readProfileEnvelope(await usersControllerGetMe()),
  })
}
