import type { CertExtractionFields, CertExtractionResult, JobProgressEvent } from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import CertSetupExtractionStep from '~/components/admin/CertSetupExtractionStep.vue'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'
import { useReadionEventSource } from '~/composables/useReadionEventSource'
import { certSetupControllerReadExtraction } from '~~/src/api/cert-setup/cert-setup'

vi.mock('~~/src/api/cert-setup/cert-setup')
vi.mock('~/composables/useReadionEventSource')

const JOB_ID = 'extract-job-1'

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

type StreamMessage = JobProgressEvent<CertExtractionResult>

type Status = { state: string; fields: CertExtractionFields | null }

function statusEnvelope(status: Status) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  return { data: { data: status }, status: 200, headers: new Headers() } as any
}

// Controllable SSE stream: the component reads `latestMessage`; tests push terminal payloads.
const latestMessage = ref<StreamMessage>()
const closeStream = vi.fn()

function pushEvent(message: StreamMessage) {
  latestMessage.value = message
  return nextTick()
}

function setupWizardAtStep2() {
  const wizard = useCertSetupWizard()
  wizard.state.name = 'AWS Certified Solutions Architect — Associate'
  wizard.state.code = 'SAA-C03'
  wizard.state.confirmedSourceUrl = 'https://aws.amazon.com/saa/'
  wizard.state.extractionJobId = JOB_ID
  wizard.state.step = 2
  return wizard
}

function mountStep(wizard: ReturnType<typeof setupWizardAtStep2>) {
  return mount(CertSetupExtractionStep, {
    props: {
      state: wizard.state,
      applyExtraction: wizard.applyExtraction,
      editFieldValue: wizard.editFieldValue,
      flagField: wizard.flagField,
    },
  })
}

async function completeViaStream() {
  await pushEvent({ jobId: JOB_ID, state: 'completed', result: { fields: EXTRACTION_FIELDS } })
  await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
  latestMessage.value = undefined
  vi.mocked(useReadionEventSource).mockReturnValue({
    latestMessage,
    close: closeStream,
    source: shallowRef(),
    status: ref('open'),
    // biome-ignore lint/suspicious/noExplicitAny: partial mock of the composable return
  } as any)
  // The status GET is the SSE fallback only; default it to in-flight so completion arrives via stream.
  vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
    statusEnvelope({ state: 'active', fields: null }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CertSetupExtractionStep stream', () => {
  it('renders the four grounded fields from a pushed completed event without polling', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)

    expect(wrapper.find('[data-testid="extraction-loading"]').exists()).toBe(true)

    await completeViaStream()

    // Fallback GET is hit at most once (initial paint), never on an interval.
    expect(vi.mocked(certSetupControllerReadExtraction).mock.calls.length).toBeLessThanOrEqual(1)
    expect(wrapper.find('[data-testid="extraction-field-domains"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="extraction-field-domains"]').text()).toContain(
      'Design Secure Architectures',
    )
    expect(wrapper.find('[data-testid="extraction-field-timeLimitMinutes"]').text()).toContain(
      '130',
    )

    wrapper.unmount()
  })

  it('closes the stream on the terminal event so it does not reconnect', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    expect(closeStream).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('renders a grounded field next to its cited passage and value', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    const passing = wrapper.find('[data-testid="extraction-field-passingScore"]')
    expect(passing.text()).toContain('67')
    expect(passing.text()).toContain(CITATION.passage)

    wrapper.unmount()
  })

  it('marks an unverified field as confirm-manually', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    expect(wrapper.find('[data-testid="extraction-field-questionCount"]').text()).toMatch(
      /confirm manually/i,
    )

    wrapper.unmount()
  })

  it('populates fieldValues from grounded values and leaves unverified fields null', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    expect(wizard.state.fieldValues.passingScore).toBe(67)
    expect(wizard.state.fieldValues.timeLimitMinutes).toBe(130)
    expect(wizard.state.fieldValues.domains).toHaveLength(4)
    expect(wizard.state.fieldValues.questionCount).toBeNull()
    expect(wizard.state.fields).not.toBeNull()

    wrapper.unmount()
  })

  it('renders extracted fields when the fallback status GET already completed the job', async () => {
    // A job that finished before the stream connected: the single fallback GET carries the fields.
    vi.mocked(certSetupControllerReadExtraction).mockResolvedValue(
      statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }),
    )
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-testid="extraction-field-passingScore"]').text()).toContain('67')

    wrapper.unmount()
  })

  it('surfaces a retryable error on a failed event and recovers on retry', async () => {
    // onMounted fallback is in-flight; retry re-fetches and finds a completed job.
    vi.mocked(certSetupControllerReadExtraction)
      .mockResolvedValueOnce(statusEnvelope({ state: 'active', fields: null }))
      .mockResolvedValue(statusEnvelope({ state: 'completed', fields: EXTRACTION_FIELDS }))

    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)

    await pushEvent({ jobId: JOB_ID, state: 'failed' })
    expect(wrapper.find('[data-testid="extraction-error"]').exists()).toBe(true)

    await wrapper.find('[data-testid="extraction-retry-btn"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-testid="extraction-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="extraction-field-passingScore"]').exists()).toBe(true)

    wrapper.unmount()
  })
})

describe('CertSetupExtractionStep review state', () => {
  it('flags a grounded field as manual when its value is edited and updates the working value', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    await wrapper
      .find('[data-testid="extraction-field-passingScore"] [data-testid="field-value-input"]')
      .setValue('72')

    expect(wizard.state.fieldValues.passingScore).toBe(72)
    expect(wizard.state.manualFields).toContain('passingScore')

    wrapper.unmount()
  })

  it('flags an unverified field as manual when a value is entered', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    await wrapper
      .find('[data-testid="extraction-field-questionCount"] [data-testid="field-value-input"]')
      .setValue('65')

    expect(wizard.state.fieldValues.questionCount).toBe(65)
    expect(wizard.state.manualFields).toContain('questionCount')

    wrapper.unmount()
  })

  it('records a per-field confirm as client review state without flagging it manual', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    const field = wrapper.find('[data-testid="extraction-field-passingScore"]')
    await field.find('[data-testid="field-confirm-btn"]').trigger('click')

    expect(field.attributes('data-review')).toBe('confirmed')
    expect(wizard.state.manualFields).not.toContain('passingScore')

    wrapper.unmount()
  })

  it('flags a field as uncertain via the per-field flag button', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

    await wrapper
      .find('[data-testid="extraction-field-timeLimitMinutes"] [data-testid="field-flag-btn"]')
      .trigger('click')

    expect(wizard.state.manualFields).toContain('timeLimitMinutes')

    wrapper.unmount()
  })
})

describe('CertSetupExtractionStep identity + guards', () => {
  it('binds the identity inputs to wizard state and exposes no publish button', async () => {
    const wizard = setupWizardAtStep2()
    const wrapper = mountStep(wizard)
    await completeViaStream()

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
