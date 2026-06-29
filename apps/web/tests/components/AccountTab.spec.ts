import type { UserProfileResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AccountTab from '~/components/AccountTab.vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { authControllerForgotPassword } from '~~/src/api/auth/auth'
import { usersControllerGetMe, usersControllerUpdateMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/auth/auth')

const forgotPasswordEnvelope = () => ({
  data: undefined,
  status: 202,
  headers: new Headers(),
})

const PROFILE: UserProfileResponse = {
  id: '77777777-7777-7777-7777-777777777777',
  email: 'jamie@org.io',
  role: 'user',
  emailVerified: true,
  displayTimezone: 'Europe/Helsinki',
  sessionDefaults: {
    duration: 30,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
  },
}

const profileEnvelope = (profile: UserProfileResponse) => ({
  data: { data: profile },
  status: 200,
  headers: new Headers(),
})

function stubProfile(profile: UserProfileResponse = PROFILE) {
  vi.mocked(usersControllerGetMe).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    profileEnvelope(profile) as any,
  )
}

function mountTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(AccountTab, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient, invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('AccountTab profile identity', () => {
  it('renders the email read-only and no Full name field', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    const email = wrapper.find('[data-testid="account-email"]')
    expect(email.exists()).toBe(true)
    expect(email.text()).toContain('jamie@org.io')
    expect(email.element.tagName).not.toBe('INPUT')

    expect(wrapper.find('[data-testid="account-full-name"]').exists()).toBe(false)
  })

  it('shows a derived initials avatar from the email', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    const avatar = wrapper.find('[data-testid="account-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.text()).toBe('JA')
  })
})

describe('AccountTab timezone control', () => {
  it('renders a native select seeded from the profile displayTimezone', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    const select = wrapper.find('[data-testid="timezone-select"]')
    expect(select.exists()).toBe(true)
    expect(select.element.tagName).toBe('SELECT')
    expect((select.element as HTMLSelectElement).value).toBe('Europe/Helsinki')

    const optionValues = select.findAll('option').map((o) => o.element.value)
    expect(optionValues).toContain('America/New_York')
    expect(optionValues).toContain('Europe/Helsinki')
  })

  it('saves the selected timezone via PATCH and invalidates the profile query', async () => {
    stubProfile()
    vi.mocked(usersControllerUpdateMe).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      profileEnvelope({ ...PROFILE, displayTimezone: 'America/New_York' }) as any,
    )

    const { wrapper, invalidateSpy } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="timezone-select"]').setValue('America/New_York')
    await wrapper.find('[data-testid="save-timezone-btn"]').trigger('click')
    await flushPromises()

    expect(usersControllerUpdateMe).toHaveBeenCalledTimes(1)
    expect(usersControllerUpdateMe).toHaveBeenCalledWith(
      expect.objectContaining({ body: JSON.stringify({ displayTimezone: 'America/New_York' }) }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsQueryKeys.profile() })
  })

  it('surfaces a 422 error and keeps the control editable', async () => {
    stubProfile()
    vi.mocked(usersControllerUpdateMe).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid timezone',
      }),
    )

    const { wrapper } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="timezone-select"]').setValue('America/New_York')
    await wrapper.find('[data-testid="save-timezone-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="timezone-error"]').exists()).toBe(true)
    const select = wrapper.find('[data-testid="timezone-select"]')
    expect(select.attributes('disabled')).toBeUndefined()
    expect((select.element as HTMLSelectElement).value).toBe('America/New_York')
  })
})

describe('AccountTab password reset action', () => {
  it('renders no current/new/confirm password fields', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="current-password-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="new-password-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="confirm-password-input"]').exists()).toBe(false)
    expect(wrapper.findAll('input[type="password"]')).toHaveLength(0)
  })

  it('requests a reset link for the signed-in email and shows a confirmation', async () => {
    stubProfile()
    vi.mocked(authControllerForgotPassword).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      forgotPasswordEnvelope() as any,
    )

    const { wrapper } = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="reset-link-confirmation"]').exists()).toBe(false)

    await wrapper.find('[data-testid="request-reset-btn"]').trigger('click')
    await flushPromises()

    expect(authControllerForgotPassword).toHaveBeenCalledTimes(1)
    expect(authControllerForgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({ body: JSON.stringify({ email: 'jamie@org.io' }) }),
    )
    expect(wrapper.find('[data-testid="reset-link-confirmation"]').exists()).toBe(true)
  })

  it('surfaces an error when the reset request fails', async () => {
    stubProfile()
    vi.mocked(authControllerForgotPassword).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Too Many Requests',
        status: 429,
        detail: 'Please wait before requesting another reset link.',
      }),
    )

    const { wrapper } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="request-reset-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="reset-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reset-link-confirmation"]').exists()).toBe(false)
  })
})
