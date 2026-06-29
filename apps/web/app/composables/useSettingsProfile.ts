import { type UserProfileResponse, userProfileResponseSchema } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { usersControllerGetMe } from '~~/src/api/users/users'

// The profile client method is weakly typed (`data: void`) because the users controller has no
// swagger DTOs, so the Settings page narrows the envelope by parsing it through the shared schema.
const parseProfileEnvelope = (response: { data: unknown }): UserProfileResponse =>
  userProfileResponseSchema.parse((response.data as { data: unknown }).data)

export function useSettingsProfile() {
  return useQuery({
    queryKey: settingsQueryKeys.profile(),
    queryFn: async (): Promise<UserProfileResponse> =>
      parseProfileEnvelope(await usersControllerGetMe()),
  })
}
