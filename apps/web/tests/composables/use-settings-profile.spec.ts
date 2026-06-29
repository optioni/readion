import type { UserProfileResponse } from '@readion/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { useSettingsProfile } from '~/composables/useSettingsProfile'
import { usersControllerGetMe } from '~~/src/api/users/users'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/users/users')

const profileFixture: UserProfileResponse = {
  id: 'user-1',
  email: 'learner@example.com',
  role: 'user',
  emailVerified: true,
  displayTimezone: 'Europe/Helsinki',
  digestOptOut: false,
  sessionDefaults: {
    duration: 30,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
  },
}

const profileEnvelope = {
  data: { data: profileFixture },
  status: 200,
  headers: new Headers(),
}

describe('useSettingsProfile', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reads and narrows the profile from usersControllerGetMe', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(usersControllerGetMe).mockResolvedValue(profileEnvelope as any)

    const { result } = renderComposable(() => useSettingsProfile())

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(profileFixture)
    })
    expect(usersControllerGetMe).toHaveBeenCalledOnce()
  })

  it('caches the profile under the shared settings profile key', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(usersControllerGetMe).mockResolvedValue(profileEnvelope as any)

    const { result, queryClient } = renderComposable(() => useSettingsProfile())

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(profileFixture)
    })
    expect(queryClient.getQueryData(settingsQueryKeys.profile())).toEqual(profileFixture)
  })

  it('rejects an envelope that violates the user profile schema', async () => {
    const badEnvelope = {
      data: { data: { ...profileFixture, displayTimezone: 'Not/AZone' } },
      status: 200,
      headers: new Headers(),
    }
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(usersControllerGetMe).mockResolvedValue(badEnvelope as any)

    const { result } = renderComposable(() => useSettingsProfile())

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })
  })
})
