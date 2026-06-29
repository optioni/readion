import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import NotificationsTab from '~/components/NotificationsTab.vue'
import { settingsQueryKeys } from '~/composables/settingsQueryKeys'
import { usersControllerGetMe, usersControllerUpdateMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')

const profileEnvelope = (digestOptOut: boolean) => ({
  data: {
    data: {
      id: 'user-1',
      email: 'learner@example.com',
      role: 'user',
      emailVerified: true,
      displayTimezone: 'Europe/Helsinki',
      digestOptOut,
      sessionDefaults: {
        duration: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: 'auto',
        learningStyle: 'weak-area-focus',
      },
    },
  },
  status: 200,
  headers: new Headers(),
})

function stubProfile(digestOptOut: boolean) {
  vi.mocked(usersControllerGetMe).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    profileEnvelope(digestOptOut) as any,
  )
}

function stubUpdate(digestOptOut: boolean) {
  vi.mocked(usersControllerUpdateMe).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    profileEnvelope(digestOptOut) as any,
  )
}

function mountTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(NotificationsTab, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient, invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('NotificationsTab weekly digest switch', () => {
  it('renders an accessible switch seeded ON when the user is subscribed', async () => {
    stubProfile(false)
    const { wrapper } = mountTab()
    await flushPromises()

    const toggle = wrapper.find('[data-testid="digest-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-checked')).toBe('true')
  })

  it('renders the switch seeded OFF when the user has opted out', async () => {
    stubProfile(true)
    const { wrapper } = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="digest-toggle"]').attributes('aria-checked')).toBe('false')
  })

  it('opts out via PATCH and invalidates the profile query when toggled off', async () => {
    stubProfile(false)
    stubUpdate(true)

    const { wrapper, invalidateSpy } = mountTab()
    await flushPromises()

    stubProfile(true)
    await wrapper.find('[data-testid="digest-toggle"]').trigger('click')
    await flushPromises()

    expect(usersControllerUpdateMe).toHaveBeenCalledTimes(1)
    expect(usersControllerUpdateMe).toHaveBeenCalledWith({ digestOptOut: true })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: settingsQueryKeys.profile() })
    expect(wrapper.find('[data-testid="digest-toggle"]').attributes('aria-checked')).toBe('false')
  })

  it('re-subscribes via PATCH when toggled on from an opted-out state', async () => {
    stubProfile(true)
    stubUpdate(false)

    const { wrapper } = mountTab()
    await flushPromises()

    stubProfile(false)
    await wrapper.find('[data-testid="digest-toggle"]').trigger('click')
    await flushPromises()

    expect(usersControllerUpdateMe).toHaveBeenCalledWith({ digestOptOut: false })
    expect(wrapper.find('[data-testid="digest-toggle"]').attributes('aria-checked')).toBe('true')
  })

  it('reverts the switch and surfaces an error when the PATCH fails', async () => {
    stubProfile(false)
    vi.mocked(usersControllerUpdateMe).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Could not update preference',
      }),
    )

    const { wrapper, invalidateSpy } = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="digest-toggle"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="digest-error"]').text()).toContain('Could not update')
    expect(wrapper.find('[data-testid="digest-toggle"]').attributes('aria-checked')).toBe('true')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('keeps a pointer to the one-click email unsubscribe link', async () => {
    stubProfile(false)
    const { wrapper } = mountTab()
    await flushPromises()

    const copy = wrapper.text().toLowerCase()
    expect(copy).toContain('unsubscribe')
    expect(copy).toContain('email')
  })
})
