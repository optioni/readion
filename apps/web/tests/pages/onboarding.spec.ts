import type { SessionDefaults } from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ComputedRef, computed } from 'vue'
import { ADMIN_CERT_SETUP_ROUTE } from '~/composables/onboardingRoutes'
import type { OnboardingDecision } from '~/composables/resolveOnboardingRoute'
import { useOnboardingActions } from '~/composables/useOnboardingActions'
import { useOnboardingGate } from '~/composables/useOnboardingGate'
import OnboardingPage from '~/pages/onboarding/index.vue'

vi.mock('~/composables/useOnboardingGate', () => ({ useOnboardingGate: vi.fn() }))
vi.mock('~/composables/useOnboardingActions', () => ({ useOnboardingActions: vi.fn() }))

vi.mock('~/components/OnboardingCertSelect.vue', () => ({
  default: {
    name: 'OnboardingCertSelect',
    emits: ['continue'],
    template: '<div data-testid="cert-select-stub" />',
  },
}))

vi.mock('~/components/OnboardingSessionPrefs.vue', () => ({
  default: {
    name: 'OnboardingSessionPrefs',
    emits: ['confirm'],
    template: '<div data-testid="session-prefs-stub" />',
  },
}))

vi.mock('~/components/OnboardingDiagnosticOffer.vue', () => ({
  default: {
    name: 'OnboardingDiagnosticOffer',
    props: ['enrollmentId'],
    template: '<div data-testid="diagnostic-offer-stub" :data-enrollment-id="enrollmentId" />',
  },
}))

const sessionDefaults: SessionDefaults = {
  duration: 60,
  contentMix: 'balanced',
  difficulty: 'adaptive',
  focusArea: 'auto',
  learningStyle: 'spaced-repetition',
}

let navigated: string | null

function stubGate(options: {
  decision: OnboardingDecision | null
  isLoading?: boolean
  isError?: boolean
}) {
  const decision: ComputedRef<OnboardingDecision | null> = computed(() => options.decision)
  vi.mocked(useOnboardingGate).mockReturnValue({
    decision,
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    sessionDefaults: computed(() => null),
  })
}

const saveDefaultsAndEnroll = vi.fn()

function stubActions() {
  vi.mocked(useOnboardingActions).mockReturnValue({
    saveDefaultsAndEnroll,
    takeDiagnostic: vi.fn(),
    skipDiagnostic: vi.fn(),
  })
}

beforeEach(() => {
  navigated = null
  vi.clearAllMocks()
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('navigateTo', (dest: string) => {
    navigated = dest
    return dest
  })
  stubActions()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountPage() {
  return mount(OnboardingPage)
}

describe('Onboarding page step flow', () => {
  it('starts on the cert-select step', () => {
    stubGate({ decision: { kind: 'onboarding' } })
    const wrapper = mountPage()

    expect(wrapper.find('[data-testid="onboarding-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cert-select-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-prefs-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diagnostic-offer-stub"]').exists()).toBe(false)
  })

  it('advances to the prefs step when cert-select emits continue', async () => {
    stubGate({ decision: { kind: 'onboarding' } })
    const wrapper = mountPage()

    await wrapper.findComponent({ name: 'OnboardingCertSelect' }).vm.$emit('continue', 'cert-1')

    expect(wrapper.find('[data-testid="cert-select-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="session-prefs-stub"]').exists()).toBe(true)
  })

  it('enrolls and advances to the offer step with the enrollment id when prefs confirm succeeds', async () => {
    stubGate({ decision: { kind: 'onboarding' } })
    saveDefaultsAndEnroll.mockResolvedValue({ ok: true, enrollmentId: 'enr-42' })
    const wrapper = mountPage()

    await wrapper.findComponent({ name: 'OnboardingCertSelect' }).vm.$emit('continue', 'cert-1')
    await wrapper
      .findComponent({ name: 'OnboardingSessionPrefs' })
      .vm.$emit('confirm', sessionDefaults)
    await flushPromises()

    expect(saveDefaultsAndEnroll).toHaveBeenCalledWith({
      certificationId: 'cert-1',
      sessionDefaults,
    })
    const offer = wrapper.find('[data-testid="diagnostic-offer-stub"]')
    expect(offer.exists()).toBe(true)
    expect(offer.attributes('data-enrollment-id')).toBe('enr-42')
  })

  it('stays on the prefs step and surfaces an error when enrollment fails', async () => {
    stubGate({ decision: { kind: 'onboarding' } })
    saveDefaultsAndEnroll.mockResolvedValue({ ok: false, error: new Error('boom') })
    const wrapper = mountPage()

    await wrapper.findComponent({ name: 'OnboardingCertSelect' }).vm.$emit('continue', 'cert-1')
    await wrapper
      .findComponent({ name: 'OnboardingSessionPrefs' })
      .vm.$emit('confirm', sessionDefaults)
    await flushPromises()

    expect(wrapper.find('[data-testid="session-prefs-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diagnostic-offer-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="onboarding-enroll-error"]').exists()).toBe(true)
  })
})

describe('Onboarding page no-certs empty state', () => {
  it('renders the empty state and not the cert picker for the no-certs decision', () => {
    stubGate({ decision: { kind: 'no-certs' } })
    const wrapper = mountPage()

    expect(wrapper.text()).toMatch(/no certifications available yet/i)
    expect(wrapper.find('[data-testid="cert-select-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="onboarding-page"]').exists()).toBe(false)
  })
})

describe('Onboarding page defensive redirects', () => {
  it('redirects an already-enrolled user to the dashboard', () => {
    stubGate({ decision: { kind: 'dashboard' } })
    mountPage()

    expect(navigated).toBe('/')
  })

  it('redirects an admin with no certs to the admin cert-setup route', () => {
    stubGate({ decision: { kind: 'admin-cert-setup' } })
    mountPage()

    expect(navigated).toBe(ADMIN_CERT_SETUP_ROUTE)
  })

  it('renders neither the flow nor the empty state while the gate is loading', () => {
    stubGate({ decision: null, isLoading: true })
    const wrapper = mountPage()

    expect(wrapper.find('[data-testid="cert-select-stub"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/no certifications available yet/i)
    expect(navigated).toBeNull()
  })
})
