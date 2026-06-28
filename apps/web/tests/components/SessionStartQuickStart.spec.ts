import type { SessionDefaults } from '@readion/shared'
import { DEFAULT_SESSION_DEFAULTS } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SessionStartQuickStart from '~/components/SessionStartQuickStart.vue'
import { createSession } from '~/composables/sessionViewApi'
import { userCertificationsControllerListWeakAreas } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerGetMe } from '~~/src/api/users/users'

vi.mock('~/composables/sessionViewApi', () => ({ createSession: vi.fn() }))
vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/user-certifications/user-certifications')

const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

type WeakArea = { domain: string; score: number }

const profileEnvelope = (sessionDefaults: SessionDefaults) => ({
  data: {
    data: {
      id: 'user-1',
      email: 'learner@example.com',
      role: 'student',
      displayName: 'Learner',
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults,
    },
  },
  status: 200,
  headers: new Headers(),
})

function stubProfile(sessionDefaults: SessionDefaults) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(usersControllerGetMe).mockResolvedValue(profileEnvelope(sessionDefaults) as any)
}

function stubWeakAreas(weakAreas: WeakArea[]) {
  vi.mocked(userCertificationsControllerListWeakAreas).mockResolvedValue({
    data: { data: weakAreas },
    status: 200,
    headers: new Headers(),
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  } as any)
}

function mountPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(SessionStartQuickStart, {
    props: { enrollmentId: 'enr-1' },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

beforeEach(() => {
  stubProfile(DEFAULT_SESSION_DEFAULTS)
  stubWeakAreas([])
  // biome-ignore lint/suspicious/noExplicitAny: session detail narrowed to fields under assertion
  vi.mocked(createSession).mockResolvedValue({ data: { id: 'sess-1' }, relationships: {} } as any)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SessionStartQuickStart defaults summary', () => {
  it('renders the saved-defaults summary read from the profile', async () => {
    stubProfile({
      duration: 60,
      contentMix: 'quiz-heavy',
      difficulty: 'advanced',
      focusArea: 'review',
      learningStyle: 'spaced-repetition',
    })

    const wrapper = mountPanel()
    await flushPromises()

    const summary = wrapper.find('[data-testid="quick-start-defaults"]')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('60')
    expect(summary.text()).toContain('quiz-heavy')
    expect(summary.text()).toContain('advanced')
    expect(summary.text()).toContain('spaced-repetition')
  })
})

describe('SessionStartQuickStart suggested focus banner', () => {
  it('names the lowest-scoring weak domain and its score', async () => {
    stubWeakAreas([
      { domain: 'Networking & CDN', score: 60 },
      { domain: 'IAM & Security', score: 45 },
    ])

    const wrapper = mountPanel()
    await flushPromises()

    const banner = wrapper.find('[data-testid="suggested-focus-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('IAM & Security')
    expect(banner.text()).toContain('45')
  })

  it('hides the banner when there is no weak-area data', async () => {
    stubWeakAreas([])

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="suggested-focus-banner"]').exists()).toBe(false)
  })
})

describe('SessionStartQuickStart start action', () => {
  it('creates a session with an empty body and navigates to the run path', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="quick-start-button"]').trigger('click')
    await flushPromises()

    expect(createSession).toHaveBeenCalledWith('enr-1')
    expect(mockNavigate).toHaveBeenCalledWith('/sessions/sess-1')
  })

  it('emits customise when the customise link is clicked', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="customise-link"]').trigger('click')

    expect(wrapper.emitted('customise')).toHaveLength(1)
  })
})
