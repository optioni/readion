import type { UserProfileResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AccountTab from '~/components/AccountTab.vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { useAuthStore } from '~/stores/auth'
import { authControllerForgotPassword } from '~~/src/api/auth/auth'
import {
  usersControllerDeleteMe,
  usersControllerGetMe,
  usersControllerUpdateMe,
} from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/auth/auth')

const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

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

let pinia: ReturnType<typeof createPinia>

function mountTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(AccountTab, {
    global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient, invalidateSpy }
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

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

const deleteEnvelope = () => ({
  data: undefined,
  status: 204,
  headers: new Headers(),
})

function seedAuth() {
  const auth = useAuthStore()
  auth.setSession('tok', {
    id: PROFILE.id,
    email: PROFILE.email,
    emailVerified: true,
    displayTimezone: 'Europe/Helsinki',
    createdAt: '',
    role: 'user',
  })
  return auth
}

describe('AccountTab delete account danger zone', () => {
  it('shows the danger-zone button but no modal until it is clicked', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="delete-account-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="delete-account-modal"]').exists()).toBe(false)

    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-account-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="delete-password-input"]').exists()).toBe(true)
  })

  it('blocks confirmation and sends no request when the password is empty', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click')

    const confirm = wrapper.find('[data-testid="confirm-delete-btn"]')
    expect(confirm.attributes('disabled')).toBeDefined()

    await confirm.trigger('click')
    await flushPromises()

    expect(usersControllerDeleteMe).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="delete-account-modal"]').exists()).toBe(true)
  })

  it('deletes the account, clears auth, and redirects to login on success', async () => {
    stubProfile()
    vi.mocked(usersControllerDeleteMe).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      deleteEnvelope() as any,
    )
    const auth = seedAuth()

    const { wrapper } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click')
    await wrapper.find('[data-testid="delete-password-input"]').setValue('hunter2')
    await wrapper.find('[data-testid="confirm-delete-btn"]').trigger('click')
    await flushPromises()

    expect(usersControllerDeleteMe).toHaveBeenCalledTimes(1)
    expect(usersControllerDeleteMe).toHaveBeenCalledWith(
      expect.objectContaining({ body: JSON.stringify({ password: 'hunter2' }) }),
    )
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('keeps the modal open with an invalid-password error and leaves auth intact on 401', async () => {
    stubProfile()
    vi.mocked(usersControllerDeleteMe).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid password',
      }),
    )
    const auth = seedAuth()

    const { wrapper } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click')
    await wrapper.find('[data-testid="delete-password-input"]').setValue('wrong-pass')
    await wrapper.find('[data-testid="confirm-delete-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="delete-account-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="delete-account-error"]').exists()).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user).not.toBeNull()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
