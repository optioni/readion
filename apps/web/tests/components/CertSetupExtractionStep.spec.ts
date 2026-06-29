import type { CertExtractionFields } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CertSetupExtractionStep from '~/components/admin/CertSetupExtractionStep.vue'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'
import { certSetupControllerReadExtraction } from '~~/src/api/cert-setup/cert-setup'

vi.mock('~~/src/api/cert-setup/cert-setup')

const CITATION = {
  url: 'https://aws.amazon.com/saa/guide.pdf',
  passage: 'a passing scaled score of 720 out of 1000 (≈67%)',
}

const EXTRACTION_FIELDS: CertExtractionFields = {
  domains: {
    value: [
      { name: 'Design Secure Architectures', weight: 30 },
      { name: 'Design Resilient Architectures', weight: 26 },
      { name: 'Design High-Performing Architectures', weight: 24 },
      { name: 'Design Cost-Optimized Architectures', weight: 20 },
    ],
    citation: { url: 'https://aws.amazon.com/saa/guide.pdf', passage: 'Four domains weighted' },
  },
  questionCount: { unverified: true },
  passingScore: { value: 67, citation: CITATION },
  timeLimitMinutes: {
    value: 130,
    citation: { url: 'https://aws.amazon.com/saa/guide.pdf', passage: '130 minutes' },
  },
}

type Status = { state: string; fields: CertExtractionFields | null }

function statusEnvelope(status: Status) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  return { data: { data: status }, status: 200, headers: new Headers() } as any
}

function setupWizardAtStep2() {
  const wizard = useCertSetupWizard()
  wizard.state.name = 'AWS Certified Solutions Architect — Associate'
  wizard.state.code = 'SAA-C03'
  wizard.state.confirmedSourceUrl = 'https://aws.amazon.com/saa/'
  wizard.state.extractionJobId = 'extract-job-1'
  wizard.state.step = 2
  return wizard
}

function mountStep(wizard: ReturnType<typeof setupWizardAtStep2>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = mount(CertSetupExtractionStep, {
    props: {
      state: wizard.state,
      applyExtraction: wizard.applyExtraction,
      editFieldValue: wizard.editFieldValue,
      flagField: wizard.flagField,
    },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return wrapper
}

async function pollToComplete() {
  await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(1500)
  await vi.advanceTimersByTimeAsync(0)
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CertSetupExtractionStep poll', () => {
  it('polls the extraction job until fields are present, then renders the four grounded fields', async () => {
    vi.mocked(certSetupControllerReadExtraction)
      .mockResolvedValueOnce(statusEnvelope({ state: 'active', fields: null }))
      .mockResolvedValue(statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }))

    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)

    expect(wrapper.find('[data-testid="extraction-loading"]').exists()).toBe(true)

    await pollToComplete()

    expect(certSetupControllerReadExtraction).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="extraction-field-domains"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="extraction-field-domains"]').text()).toContain(
      'Design Secure Architectures',
    )
    expect(wrapper.find('[data-testid="extraction-field-timeLimitMinutes"]').text()).toContain(
      '130',
    )

    wrapper.unmount()
  })

  it('renders a grounded field next to its cited passage and value', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await pollToComplete()

    const passing = wrapper.find('[data-testid="extraction-field-passingScore"]')
    expect(passing.text()).toContain('67')
    expect(passing.text()).toContain(CITATION.passage)

    wrapper.unmount()
  })

  it('marks an unverified field as confirm-manually', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await pollToComplete()

    expect(wrapper.find('[data-testid="extraction-field-questionCount"]').text()).toMatch(
      /confirm manually/i,
    )

    wrapper.unmount()
  })

  it('populates fieldValues from grounded values and leaves unverified fields null', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await pollToComplete()

    expect(wizard.state.fieldValues.passingScore).toBe(67)
    expect(wizard.state.fieldValues.timeLimitMinutes).toBe(130)
    expect(wizard.state.fieldValues.domains).toHaveLength(4)
    expect(wizard.state.fieldValues.questionCount).toBeNull()
    expect(wizard.state.fields).not.toBeNull()

    wrapper.unmount()
  })

  it('surfaces a retryable error on a terminal state with no fields and recovers on retry', async () => {
    vi.mocked(certSetupControllerReadExtraction)
      .mockResolvedValueOnce(statusEnvelope({ state: 'failed', fields: null }))
      .mockResolvedValue(statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }))

    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)

    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
    expect(wrapper.find('[data-testid="extraction-error"]').exists()).toBe(true)

    await wrapper.find('[data-testid="extraction-retry-btn"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(wrapper.find('[data-testid="extraction-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="extraction-field-passingScore"]').exists()).toBe(true)

    wrapper.unmount()
  })
})

describe('CertSetupExtractionStep review state', () => {
  it('flags a grounded field as manual when its value is edited and updates the working value', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await pollToComplete()

    await wrapper
      .find('[data-testid="extraction-field-passingScore"] [data-testid="field-value-input"]')
      .setValue('72')

    expect(wizard.state.fieldValues.passingScore).toBe(72)
    expect(wizard.state.manualFields).toContain('passingScore')

    wrapper.unmount()
  })

  it('flags an unverified field as manual when a value is entered', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await pollToComplete()

    await wrapper
      .find('[data-testid="extraction-field-questionCount"] [data-testid="field-value-input"]')
      .setValue('65')

    expect(wizard.state.fieldValues.questionCount).toBe(65)
    expect(wizard.state.manualFields).toContain('questionCount')

    wrapper.unmount()
  })

  it('flags a field as uncertain via the per-field flag button', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await pollToComplete()

    await wrapper
      .find('[data-testid="extraction-field-timeLimitMinutes"] [data-testid="field-flag-btn"]')
      .trigger('click')

    expect(wizard.state.manualFields).toContain('timeLimitMinutes')

    wrapper.unmount()
  })
})

describe('CertSetupExtractionStep identity + guards', () => {
  it('binds the identity inputs to wizard state and exposes no publish button', async () => {
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await pollToComplete()

    await wrapper.find('[data-testid="cert-name-input"]').setValue('AWS SAA Associate')
    await wrapper.find('[data-testid="cert-provider-input"]').setValue('Amazon Web Services')
    await wrapper.find('[data-testid="cert-code-input"]').setValue('SAA-C03')

    expect(wizard.state.identity).toEqual({
      name: 'AWS SAA Associate',
      provider: 'Amazon Web Services',
      code: 'SAA-C03',
    })
    expect(wrapper.findAll('[data-testid="publish-cert-btn"]')).toHaveLength(0)

    wrapper.unmount()
  })
})
