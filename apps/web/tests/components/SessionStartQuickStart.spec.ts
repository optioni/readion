import type { SessionDefaults } from '@readion/shared'
import { DEFAULT_SESSION_DEFAULTS } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import SessionStartQuickStart from '~/components/SessionStartQuickStart.vue'
import { createSession } from '~/composables/sessionViewApi'
import { useCertDetail } from '~/composables/useCertDetail'
import { userCertificationsControllerListWeakAreas } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerGetMe } from '~~/src/api/users/users'

vi.mock('~/composables/sessionViewApi', () => ({ createSession: vi.fn() }))
vi.mock('~/composables/useCertDetail', () => ({ useCertDetail: vi.fn() }))
vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/user-certifications/user-certifications')

const mockNavigate = vi.fn()
vi.stubGlobal('navigateTo', mockNavigate)

type WeakArea = { domain: string; score: number }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

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

function stubCert() {
  vi.mocked(useCertDetail).mockReturnValue({
    name: computed(() => 'Solutions Architect – Associate'),
    provider: computed(() => 'AWS'),
    code: computed(() => 'SAA-C03'),
    certificationId: computed(() => 'cert-1'),
    domains: computed(() => []),
    questionCount: computed(() => 65),
    passingScore: computed(() => null),
    isLoading: computed(() => false),
    isError: computed(() => false),
    notFound: computed(() => false),
  })
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
  stubCert()
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
    expect(summary.text()).toContain('Quiz-heavy')
    expect(summary.text()).toContain('Advanced')
    expect(summary.text()).toContain('Spaced repetition')
  })

  it('never renders raw enum slugs for humanized fields', async () => {
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
    expect(summary.text()).not.toContain('quiz-heavy')
    expect(summary.text()).not.toContain('spaced-repetition')
  })
})

describe('SessionStartQuickStart cert identity pill', () => {
  it('renders the cert code and full name above the start card', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    const pill = wrapper.find('[data-testid="cert-identity-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('SAA-C03')
    expect(pill.text()).toContain('Solutions Architect – Associate')
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
  it('shows stable starting feedback, rejects duplicates, and stays busy through navigation', async () => {
    const createGate = deferred<Awaited<ReturnType<typeof createSession>>>()
    const navigationGate = deferred<void>()
    vi.mocked(createSession).mockReturnValue(createGate.promise)
    mockNavigate.mockReturnValue(navigationGate.promise)
    const wrapper = mountPanel()
    await flushPromises()

    const button = wrapper.find('[data-testid="quick-start-button"]')
    const widthClass = button.classes()
    await button.trigger('click')
    await button.trigger('click')

    expect(createSession).toHaveBeenCalledTimes(1)
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toContain('Starting…')
    expect(button.find('[data-testid="readion-button-spinner"]').exists()).toBe(true)
    expect(button.classes()).toEqual(widthClass)

    // biome-ignore lint/suspicious/noExplicitAny: session detail narrowed to fields under assertion
    createGate.resolve({ data: { id: 'sess-1' }, relationships: {} } as any)
    await flushPromises()
    expect(mockNavigate).toHaveBeenCalledWith('/sessions/sess-1')
    expect(button.attributes('aria-busy')).toBe('true')
  })

  it('shows a local retryable failure state', async () => {
    vi.mocked(createSession).mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="quick-start-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="quick-start-error"]').attributes('role')).toBe('alert')
    expect(
      wrapper.find('[data-testid="quick-start-button"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="quick-start-button"]').text()).toContain('Start session')
  })

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
