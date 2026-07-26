import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { type DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '~/pages/settings/index.vue'
import { usersControllerGetMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  vi.clearAllMocks()
  pinia = createPinia()
  setActivePinia(pinia)

  vi.mocked(usersControllerGetMe).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    {
      data: {
        data: {
          id: 'user-1',
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
        },
      },
      status: 200,
      headers: new Headers(),
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    } as any,
  )
})

function mountPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(SettingsPage, {
    global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

// happy-dom's getComputedStyle does not reflect v-show, so DOMWrapper.isVisible() is unreliable
// here. v-show toggles the inline `display: none` style directly, which is the dependable signal.
function panelShown(wrapper: VueWrapper, testid: string): boolean {
  const panel: DOMWrapper<Element> = wrapper.find(`[data-testid="${testid}"]`)
  return !(panel.attributes('style') ?? '').includes('display: none')
}

describe('Settings page shell', () => {
  it('renders the settings page root', async () => {
    const wrapper = mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true),
    )
    expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true)
  })

  it('renders exactly three tabs in order: Account, Study defaults, Notifications', async () => {
    const wrapper = mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true),
    )
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((t) => t.attributes('data-testid'))).toEqual([
      'settings-tab-account',
      'settings-tab-study-defaults',
      'settings-tab-notifications',
    ])
    expect(tabs.map((t) => t.text())).toEqual(['Account', 'Study defaults', 'Notifications'])
  })

  it('selects the Account tab by default and shows only the account panel', async () => {
    const wrapper = mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true),
    )
    expect(wrapper.find('[data-testid="settings-tab-account"]').attributes('aria-selected')).toBe(
      'true',
    )
    expect(
      wrapper.find('[data-testid="settings-tab-study-defaults"]').attributes('aria-selected'),
    ).toBe('false')
    expect(
      wrapper.find('[data-testid="settings-tab-notifications"]').attributes('aria-selected'),
    ).toBe('false')

    expect(panelShown(wrapper, 'account-panel')).toBe(true)
    expect(panelShown(wrapper, 'study-defaults-panel')).toBe(false)
    expect(panelShown(wrapper, 'notifications-panel')).toBe(false)
  })

  it('switches to the Study defaults tab and reveals only its panel', async () => {
    const wrapper = mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true),
    )
    await wrapper.find('[data-testid="settings-tab-study-defaults"]').trigger('click')

    expect(
      wrapper.find('[data-testid="settings-tab-study-defaults"]').attributes('aria-selected'),
    ).toBe('true')
    expect(wrapper.find('[data-testid="settings-tab-account"]').attributes('aria-selected')).toBe(
      'false',
    )

    expect(panelShown(wrapper, 'study-defaults-panel')).toBe(true)
    expect(panelShown(wrapper, 'account-panel')).toBe(false)
  })

  it('switches to the Notifications tab and reveals only its panel', async () => {
    const wrapper = mountPage()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true),
    )
    await wrapper.find('[data-testid="settings-tab-notifications"]').trigger('click')

    expect(
      wrapper.find('[data-testid="settings-tab-notifications"]').attributes('aria-selected'),
    ).toBe('true')
    expect(wrapper.find('[data-testid="settings-tab-account"]').attributes('aria-selected')).toBe(
      'false',
    )

    expect(panelShown(wrapper, 'notifications-panel')).toBe(true)
    expect(panelShown(wrapper, 'account-panel')).toBe(false)
  })
})

describe('Settings profile states', () => {
  it('shows loading without rendering blank profile controls', async () => {
    const request = deferred<Awaited<ReturnType<typeof usersControllerGetMe>>>()
    vi.mocked(usersControllerGetMe).mockReturnValue(request.promise)
    const wrapper = mountPage()

    await vi.waitFor(() => expect(usersControllerGetMe).toHaveBeenCalledTimes(1))
    expect(wrapper.get('[data-testid="settings-content-region"]').attributes('aria-busy')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="account-email"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="timezone-select"]').exists()).toBe(false)
  })

  it('retries a failed profile read and replaces the error with populated content', async () => {
    vi.mocked(usersControllerGetMe)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
        {
          data: {
            data: {
              id: 'user-1',
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
            },
          },
        } as any,
      )
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="account-email"]').exists()).toBe(false)
    await wrapper.get('[data-testid="readion-async-retry"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="account-email"]').exists()).toBe(true),
    )

    expect(usersControllerGetMe).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="account-email"]').text()).toContain('jamie@org.io')
  })
})
