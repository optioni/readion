import type { DiagnosticOffer } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OnboardingDiagnosticOffer from '~/components/OnboardingDiagnosticOffer.vue'
import {
  diagnosticControllerCreate,
  diagnosticControllerDismissOffer,
  diagnosticControllerGetOffer,
} from '~~/src/api/diagnostic/diagnostic'

vi.mock('~~/src/api/diagnostic/diagnostic')

const offerEnvelope = (offer: DiagnosticOffer) => ({
  data: { data: { offer }, relationships: {} },
  status: 200,
  headers: new Headers(),
})

const createEnvelope = (id: string) => ({
  data: { data: { id, type: 'diagnostic' }, relationships: {} },
  status: 201,
  headers: new Headers(),
})

const dismissEnvelope = () => ({
  data: { data: undefined, relationships: {} },
  status: 200,
  headers: new Headers(),
})

let navigated: string | null

beforeEach(() => {
  navigated = null
  vi.clearAllMocks()
  vi.stubGlobal('navigateTo', (dest: string) => {
    navigated = dest
    return dest
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountOffer(enrollmentId = 'enr-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = mount(OnboardingDiagnosticOffer, {
    props: { enrollmentId },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}

describe('OnboardingDiagnosticOffer onboarding offer', () => {
  it('renders the offer card with Take and Skip when the offer is onboarding', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('onboarding') as any,
    )

    const { wrapper } = mountOffer()
    await flushPromises()

    const card = wrapper.find('[data-testid="diagnostic-offer"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toMatch(/2-minute diagnostic/i)
    expect(wrapper.find('[data-testid="diagnostic-offer-take"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diagnostic-offer-skip"]').exists()).toBe(true)
    expect(navigated).toBeNull()
  })

  it('starts the diagnostic and navigates to the runner when Take is clicked', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('onboarding') as any,
    )
    vi.mocked(diagnosticControllerCreate).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      createEnvelope('attempt-7') as any,
    )

    const { wrapper } = mountOffer('enr-9')
    await flushPromises()

    await wrapper.find('[data-testid="diagnostic-offer-take"]').trigger('click')
    await flushPromises()

    expect(diagnosticControllerCreate).toHaveBeenCalledWith('enr-9')
    expect(navigated).toBe('/mock-exams/attempt-7')
  })

  it('dismisses the offer and navigates to the dashboard when Skip is clicked', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('onboarding') as any,
    )
    vi.mocked(diagnosticControllerDismissOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      dismissEnvelope() as any,
    )

    const { wrapper } = mountOffer('enr-3')
    await flushPromises()

    await wrapper.find('[data-testid="diagnostic-offer-skip"]').trigger('click')
    await flushPromises()

    expect(diagnosticControllerDismissOffer).toHaveBeenCalledWith('enr-3')
    expect(navigated).toBe('/')
  })
})

describe('OnboardingDiagnosticOffer no offer', () => {
  it('does not render the card and navigates straight to the dashboard when offer is none', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('none') as any,
    )

    const { wrapper } = mountOffer()
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnostic-offer"]').exists()).toBe(false)
    expect(navigated).toBe('/')
  })
})

describe('OnboardingDiagnosticOffer loading', () => {
  it('does not navigate or render the card while the offer is loading', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockReturnValue(new Promise(() => {}))

    const { wrapper } = mountOffer()
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnostic-offer"]').exists()).toBe(false)
    expect(navigated).toBeNull()
  })
})
