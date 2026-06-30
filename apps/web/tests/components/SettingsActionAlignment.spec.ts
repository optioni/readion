import type { UserProfileResponse } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { type DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountTab from '~/components/AccountTab.vue'
import StudyDefaultsTab from '~/components/StudyDefaultsTab.vue'
import { usersControllerGetMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')

vi.stubGlobal('navigateTo', vi.fn())

const PROFILE: UserProfileResponse = {
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
}

function stubProfile() {
  vi.mocked(usersControllerGetMe).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    { data: { data: PROFILE }, status: 200, headers: new Headers() } as any,
  )
}

let pinia: ReturnType<typeof createPinia>

function mountTab(component: typeof AccountTab | typeof StudyDefaultsTab) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(component, {
    global: { plugins: [pinia, [VueQueryPlugin, { queryClient }]] },
  })
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  stubProfile()
})

afterEach(() => {
  vi.clearAllMocks()
})

function expectTrailingEdgeAligned(button: DOMWrapper<Element>) {
  expect(button.exists()).toBe(true)
  expect(button.classes()).not.toContain('self-start')

  const wrapper = button.element.parentElement
  expect(wrapper).not.toBeNull()
  expect(wrapper?.className ?? '').toContain('justify-end')
}

describe('Settings primary actions sit at the trailing edge of the reading column', () => {
  it('right-aligns the Account save-timezone action', async () => {
    const wrapper = mountTab(AccountTab)
    await flushPromises()
    expectTrailingEdgeAligned(wrapper.find('[data-testid="save-timezone-btn"]'))
  })

  it('right-aligns the Account change-password action', async () => {
    const wrapper = mountTab(AccountTab)
    await flushPromises()
    expectTrailingEdgeAligned(wrapper.find('[data-testid="change-password-btn"]'))
  })

  it('right-aligns the Account delete-account action', async () => {
    const wrapper = mountTab(AccountTab)
    await flushPromises()
    expectTrailingEdgeAligned(wrapper.find('[data-testid="delete-account-btn"]'))
  })

  it('right-aligns the Study defaults save action', async () => {
    const wrapper = mountTab(StudyDefaultsTab)
    await flushPromises()
    expectTrailingEdgeAligned(wrapper.find('[data-testid="save-defaults-btn"]'))
  })
})
