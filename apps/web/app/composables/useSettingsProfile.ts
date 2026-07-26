import { type UserProfileResponse, userProfileResponseSchema } from '@readion/shared'
import { type UseQueryReturnType, useQuery } from '@tanstack/vue-query'
import { type InjectionKey, inject } from 'vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { usersControllerGetMe } from '~~/src/api/users/users'

// The profile client method is weakly typed (`data: void`) because the users controller has no
// swagger DTOs, so the Settings page narrows the envelope by parsing it through the shared schema.
const parseProfileEnvelope = (response: { data: unknown }): UserProfileResponse =>
  userProfileResponseSchema.parse((response.data as { data: unknown }).data)

export type SettingsProfileQuery = UseQueryReturnType<UserProfileResponse, Error>
export const settingsProfileInjectionKey: InjectionKey<SettingsProfileQuery> =
  Symbol('settings-profile-query')

export function useSettingsProfile() {
  const inheritedQuery = inject(settingsProfileInjectionKey, null)
  if (inheritedQuery) {
    return inheritedQuery
  }

  return useQuery({
    queryKey: settingsQueryKeys.profile(),
    staleTime: 30_000,
    refetchOnMount: false,
    queryFn: async (): Promise<UserProfileResponse> =>
      parseProfileEnvelope(await usersControllerGetMe()),
  })
}
