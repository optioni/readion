import type { DiscoveryCandidate } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CertSetupConfirmStep from '~/components/admin/CertSetupConfirmStep.vue'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'

const CANDIDATES: DiscoveryCandidate[] = [
  { url: 'https://example.com/a', title: 'Guide A', snippet: 'first' },
  { url: 'https://example.com/b', title: 'Guide B', snippet: 'second' },
]

function buildState(overrides: Partial<CertSetupWizardState> = {}): CertSetupWizardState {
  return {
    step: 2,
    name: 'Certified Kubernetes Security Specialist',
    code: 'CKS',
    knownSourceUrl: null,
    discoveryCandidates: CANDIDATES,
    confirmedSourceUrl: null,
    extractionJobId: null,
    fields: null,
    fieldValues: {
      domains: null,
      questionCount: null,
      passingScore: null,
      timeLimitMinutes: null,
    },
    manualFields: [],
    identity: { name: '', provider: '', code: '' },
    suggestedContentSources: [],
    createdCertId: null,
    ...overrides,
  }
}

function mountStep(state = buildState()) {
  const confirmSource = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(CertSetupConfirmStep, { props: { state, confirmSource } })
  return { wrapper, confirmSource }
}

describe('CertSetupConfirmStep', () => {
  it('renders the pre-fetched candidates from wizard state with an agent-status banner', () => {
    const { wrapper } = mountStep()

    expect(wrapper.find('[data-testid="cert-confirm-step"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-agent-status"]').text()).toContain('2')
    const candidates = wrapper.findAll('[data-testid="source-candidate"]')
    expect(candidates).toHaveLength(2)
    expect(candidates[0]?.attributes('data-url')).toBe('https://example.com/a')
  })

  it('prefills the manual URL input from the known source URL entered at step 1', () => {
    const { wrapper } = mountStep(buildState({ knownSourceUrl: 'https://known.example.com/guide' }))

    expect(
      (wrapper.find('[data-testid="manual-url-input"]').element as HTMLInputElement).value,
    ).toBe('https://known.example.com/guide')
  })

  it('confirms a selected candidate', async () => {
    const { wrapper, confirmSource } = mountStep()

    await wrapper.findAll('[data-testid="source-candidate"]')[0]?.trigger('click')
    await wrapper.find('[data-testid="confirm-source-btn"]').trigger('click')

    expect(confirmSource).toHaveBeenCalledWith('https://example.com/a')
  })

  it('gates confirm on a valid url', () => {
    const { wrapper } = mountStep()

    expect(wrapper.find('[data-testid="confirm-source-btn"]').attributes('disabled')).toBeDefined()
  })
})
