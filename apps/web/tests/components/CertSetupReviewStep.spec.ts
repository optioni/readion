import type { CertExtractionFields } from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadionProblemDetailsError } from '~/api/mutator'
import CertSetupReviewStep from '~/components/admin/CertSetupReviewStep.vue'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'
import { certSetupControllerCreate } from '~~/src/api/cert-setup/cert-setup'

vi.mock('~~/src/api/cert-setup/cert-setup')

const NEW_CERT_ID = 'c0000000-0000-0000-0000-000000000002'
const CITATION = { url: 'https://aws.amazon.com/guide', passage: 'passage' }

const GROUNDED: CertExtractionFields = {
  domains: {
    value: [
      { name: 'Secure', weight: 60 },
      { name: 'Resilient', weight: 40 },
    ],
    citation: CITATION,
  },
  questionCount: { unverified: true },
  passingScore: { value: 67, citation: CITATION },
  timeLimitMinutes: { value: 130, citation: CITATION },
}

function createdEnvelope() {
  return {
    data: { data: { id: NEW_CERT_ID, state: 'draft' } },
    status: 201,
    headers: new Headers(),
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  } as any
}

function setupWizard(options: { invalidWeights?: boolean } = {}) {
  const wizard = useCertSetupWizard()
  wizard.applyExtraction(GROUNDED)
  if (options.invalidWeights) {
    wizard.editFieldValue('domains', [{ name: 'Secure', weight: 50 }])
  }
  wizard.state.identity = { name: 'AWS SAA', provider: 'AWS', code: 'SAA-C03' }
  wizard.state.confirmedSourceUrl = 'https://aws.amazon.com/guide'
  wizard.state.step = 2
  return wizard
}

function mountReview(wizard: ReturnType<typeof setupWizard>) {
  const registerCreatedDraft = vi.fn(wizard.registerCreatedDraft)
  const wrapper = mount(CertSetupReviewStep, {
    props: { state: wizard.state, registerCreatedDraft },
  })
  return { wrapper, registerCreatedDraft, state: wizard.state }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('CertSetupReviewStep gating', () => {
  it('never renders a publish button', () => {
    const { wrapper } = mountReview(setupWizard())
    expect(wrapper.find('[data-testid="publish-cert-btn"]').exists()).toBe(false)
  })

  it('disables submit when domain weights do not sum to 100', () => {
    const { wrapper } = mountReview(setupWizard({ invalidWeights: true }))
    expect(wrapper.find('[data-testid="submit-draft-btn"]').attributes('disabled')).toBeDefined()
  })

  it('enables submit when domain weights sum to 100', () => {
    const { wrapper } = mountReview(setupWizard())
    expect(wrapper.find('[data-testid="submit-draft-btn"]').attributes('disabled')).toBeUndefined()
  })
})

describe('CertSetupReviewStep submit', () => {
  it('creates a draft with the four fields, provenance map and source url', async () => {
    vi.mocked(certSetupControllerCreate).mockResolvedValue(createdEnvelope())
    const { wrapper, registerCreatedDraft } = mountReview(setupWizard())

    await wrapper.find('[data-testid="submit-draft-btn"]').trigger('click')
    await flushPromises()

    expect(certSetupControllerCreate).toHaveBeenCalledTimes(1)
    const body = JSON.parse(vi.mocked(certSetupControllerCreate).mock.calls[0]?.[0]?.body as string)
    expect(body).toEqual({
      name: 'AWS SAA',
      provider: 'AWS',
      code: 'SAA-C03',
      domains: [
        { name: 'Secure', weight: 60 },
        { name: 'Resilient', weight: 40 },
      ],
      questionCount: null,
      passingScore: 67,
      timeLimitMinutes: 130,
      provenance: {
        domains: { url: CITATION.url, passage: CITATION.passage },
        questionCount: { unverified: true },
        passingScore: { url: CITATION.url, passage: CITATION.passage },
        timeLimitMinutes: { url: CITATION.url, passage: CITATION.passage },
      },
      sourceUrl: 'https://aws.amazon.com/guide',
    })
    expect(registerCreatedDraft).toHaveBeenCalledWith(NEW_CERT_ID)
  })

  it('shows Creating… and rejects duplicate submission while the create request is pending', async () => {
    let resolveCreate: ((value: ReturnType<typeof createdEnvelope>) => void) | undefined
    vi.mocked(certSetupControllerCreate).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve
      }) as never,
    )
    const { wrapper } = mountReview(setupWizard())

    const submit = wrapper.find('[data-testid="submit-draft-btn"]')
    await submit.trigger('click')
    await flushPromises()

    expect(submit.attributes('aria-busy')).toBe('true')
    expect(submit.text()).toContain('Creating…')
    expect(submit.find('[data-testid="readion-button-spinner"]').exists()).toBe(true)

    await submit.trigger('click')
    expect(certSetupControllerCreate).toHaveBeenCalledTimes(1)

    resolveCreate?.(createdEnvelope())
    await flushPromises()
  })

  it('surfaces a 409 duplicate-code error and keeps fields editable', async () => {
    vi.mocked(certSetupControllerCreate).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Conflict',
        status: 409,
        detail: 'A certification with this code already exists.',
      }),
    )
    const { wrapper, registerCreatedDraft, state } = mountReview(setupWizard())

    await wrapper.find('[data-testid="submit-draft-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="submit-draft-error"]').text()).toContain(
      'A certification with this code already exists.',
    )
    expect(registerCreatedDraft).not.toHaveBeenCalled()
    expect(state.step).toBe(2)
  })

  it('surfaces a 422 domain-weight error from the server', async () => {
    vi.mocked(certSetupControllerCreate).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Domain weights must sum to 100.',
      }),
    )
    const { wrapper } = mountReview(setupWizard())

    await wrapper.find('[data-testid="submit-draft-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="submit-draft-error"]').text()).toContain(
      'Domain weights must sum to 100.',
    )
  })

  it('shows a generic message for a non-problem error', async () => {
    vi.mocked(certSetupControllerCreate).mockRejectedValue(new Error('network down'))
    const { wrapper } = mountReview(setupWizard())

    await wrapper.find('[data-testid="submit-draft-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="submit-draft-error"]').text()).toContain(
      'Could not create the certification.',
    )
  })

  it('does not call the API when submit is gated by the weight-sum check', async () => {
    const { wrapper } = mountReview(setupWizard({ invalidWeights: true }))

    await wrapper.find('[data-testid="submit-draft-btn"]').trigger('click')
    await flushPromises()

    expect(certSetupControllerCreate).not.toHaveBeenCalled()
  })
})
