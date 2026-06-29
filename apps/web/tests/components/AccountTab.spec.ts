import type { UserProfileResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AccountTab from '~/components/AccountTab.vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { useAuthStore } from '~/stores/auth'
import { authControllerChangePassword } from '~~/src/api/auth/auth'
import {
  usersControllerDeleteMe,
  usersControllerGetMe,
  usersControllerUpdateMe,
} from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/auth/auth')

const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

const changePasswordEnvelope = () => ({
  data: undefined,
  status: 200,
  headers: new Headers(),
})

const PROFILE: UserProfileResponse = {
  id: '77777777-7777-7777-7777-777777777777',
  email: 'jamie@org.io',
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
    expect(usersControllerUpdateMe).toHaveBeenCalledWith({ displayTimezone: 'America/New_York' })
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

async function fillPasswordForm(
  wrapper: ReturnType<typeof mountTab>['wrapper'],
  values: { current: string; next: string; confirm: string },
) {
  await wrapper.find('[data-testid="current-password-input"]').setValue(values.current)
  await wrapper.find('[data-testid="new-password-input"]').setValue(values.next)
  await wrapper.find('[data-testid="confirm-password-input"]').setValue(values.confirm)
}

describe('AccountTab change password', () => {
  it('renders current/new/confirm password inputs', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    const current = wrapper.find('[data-testid="current-password-input"]')
    const next = wrapper.find('[data-testid="new-password-input"]')
    const confirm = wrapper.find('[data-testid="confirm-password-input"]')

    expect(current.exists()).toBe(true)
    expect(next.exists()).toBe(true)
    expect(confirm.exists()).toBe(true)
    expect(current.attributes('type')).toBe('password')
    expect(next.attributes('type')).toBe('password')
    expect(confirm.attributes('type')).toBe('password')
  })

  it('submits the change, clears the form, and shows a confirmation on success', async () => {
    stubProfile()
    vi.mocked(authControllerChangePassword).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      changePasswordEnvelope() as any,
    )

    const { wrapper } = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="change-password-confirmation"]').exists()).toBe(false)

    await fillPasswordForm(wrapper, {
      current: 'oldpass1',
      next: 'newpass123',
      confirm: 'newpass123',
    })
    await wrapper.find('[data-testid="change-password-btn"]').trigger('click')
    await flushPromises()

    expect(authControllerChangePassword).toHaveBeenCalledTimes(1)
    expect(authControllerChangePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: JSON.stringify({ currentPassword: 'oldpass1', newPassword: 'newpass123' }),
      }),
    )
    expect(wrapper.find('[data-testid="change-password-confirmation"]').exists()).toBe(true)

    expect(
      (wrapper.find('[data-testid="current-password-input"]').element as HTMLInputElement).value,
    ).toBe('')
    expect(
      (wrapper.find('[data-testid="new-password-input"]').element as HTMLInputElement).value,
    ).toBe('')
    expect(
      (wrapper.find('[data-testid="confirm-password-input"]').element as HTMLInputElement).value,
    ).toBe('')
  })

  it('shows an error on the new-password field and keeps the form on 422', async () => {
    stubProfile()
    vi.mocked(authControllerChangePassword).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Password is too weak',
      }),
    )

    const { wrapper } = mountTab()
    await flushPromises()

    await fillPasswordForm(wrapper, { current: 'oldpass1', next: 'weak1234', confirm: 'weak1234' })
    await wrapper.find('[data-testid="change-password-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="new-password-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="change-password-confirmation"]').exists()).toBe(false)
    expect(
      (wrapper.find('[data-testid="new-password-input"]').element as HTMLInputElement).value,
    ).toBe('weak1234')
  })

  it('shows an error on the current-password field on 401', async () => {
    stubProfile()
    vi.mocked(authControllerChangePassword).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unauthorized',
        status: 401,
        detail: 'Current password is incorrect',
      }),
    )

    const { wrapper } = mountTab()
    await flushPromises()

    await fillPasswordForm(wrapper, {
      current: 'wrongpass',
      next: 'newpass123',
      confirm: 'newpass123',
    })
    await wrapper.find('[data-testid="change-password-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="current-password-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="change-password-confirmation"]').exists()).toBe(false)
  })

  it('shows an error on the current-password field on 403', async () => {
    stubProfile()
    vi.mocked(authControllerChangePassword).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Forbidden',
        status: 403,
        detail: 'Current password is incorrect',
      }),
    )

    const { wrapper } = mountTab()
    await flushPromises()

    await fillPasswordForm(wrapper, {
      current: 'wrongpass',
      next: 'newpass123',
      confirm: 'newpass123',
    })
    await wrapper.find('[data-testid="change-password-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="current-password-error"]').exists()).toBe(true)
  })

  it('shows a confirm error and sends no request when confirm does not match', async () => {
    stubProfile()
    const { wrapper } = mountTab()
    await flushPromises()

    await fillPasswordForm(wrapper, {
      current: 'oldpass1',
      next: 'newpass123',
      confirm: 'different123',
    })
    await wrapper.find('[data-testid="change-password-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-password-error"]').exists()).toBe(true)
    expect(authControllerChangePassword).not.toHaveBeenCalled()
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
    expect(usersControllerDeleteMe).toHaveBeenCalledWith({ password: 'hunter2' })
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
