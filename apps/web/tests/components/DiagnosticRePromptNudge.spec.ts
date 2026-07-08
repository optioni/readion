import type { DiagnosticOffer } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DiagnosticRePromptNudge from '~/components/DiagnosticRePromptNudge.vue'
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

function mountNudge(enrollmentId = 'enr-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = mount(DiagnosticRePromptNudge, {
    props: { enrollmentId },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}

describe('DiagnosticRePromptNudge visibility', () => {
  it('renders the nudge with Take and Skip when the offer is re-prompt', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('re-prompt') as any,
    )

    const { wrapper } = mountNudge()
    await flushPromises()

    const nudge = wrapper.find('[data-testid="diagnostic-reprompt"]')
    expect(nudge.exists()).toBe(true)
    expect(wrapper.find('[data-testid="diagnostic-reprompt-take"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diagnostic-reprompt-skip"]').exists()).toBe(true)
  })

  it('renders as an accent-tinted callout with a shield icon, not plain text', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('re-prompt') as any,
    )

    const { wrapper } = mountNudge()
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnostic-reprompt-icon"]').exists()).toBe(true)
    const nudge = wrapper.find('[data-testid="diagnostic-reprompt"]')
    expect(nudge.classes().join(' ')).toContain('readion-primary')
  })

  it('renders nothing when the offer is onboarding', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('onboarding') as any,
    )

    const { wrapper } = mountNudge()
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnostic-reprompt"]').exists()).toBe(false)
  })

  it('renders nothing when the offer is none', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('none') as any,
    )

    const { wrapper } = mountNudge()
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnostic-reprompt"]').exists()).toBe(false)
  })
})

describe('DiagnosticRePromptNudge actions', () => {
  it('starts the diagnostic and navigates to the runner when Take is clicked', async () => {
    vi.mocked(diagnosticControllerGetOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      offerEnvelope('re-prompt') as any,
    )
    vi.mocked(diagnosticControllerCreate).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      createEnvelope('attempt-2') as any,
    )

    const { wrapper } = mountNudge('enr-5')
    await flushPromises()

    await wrapper.find('[data-testid="diagnostic-reprompt-take"]').trigger('click')
    await flushPromises()

    expect(diagnosticControllerCreate).toHaveBeenCalledWith('enr-5')
    expect(navigated).toBe('/mock-exams/attempt-2')
  })

  it('dismisses the offer and hides the nudge without leaving the dashboard when Skip is clicked', async () => {
    vi.mocked(diagnosticControllerGetOffer)
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      .mockResolvedValueOnce(offerEnvelope('re-prompt') as any)
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      .mockResolvedValue(offerEnvelope('none') as any)
    vi.mocked(diagnosticControllerDismissOffer).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      dismissEnvelope() as any,
    )

    const { wrapper } = mountNudge('enr-8')
    await flushPromises()
    expect(wrapper.find('[data-testid="diagnostic-reprompt"]').exists()).toBe(true)

    await wrapper.find('[data-testid="diagnostic-reprompt-skip"]').trigger('click')
    await flushPromises()

    expect(diagnosticControllerDismissOffer).toHaveBeenCalledWith('enr-8')
    expect(wrapper.find('[data-testid="diagnostic-reprompt"]').exists()).toBe(false)
    expect(navigated).toBeNull()
  })
})
