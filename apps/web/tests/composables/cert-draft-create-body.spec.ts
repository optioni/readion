import type { CertExtractionFields } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { buildDraftCreateBody, canCreateDraft } from '~/composables/certDraftCreateBody'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'

const CITATION = { url: 'https://example.com/guide', passage: 'passage' }

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

function groundedWizard() {
  const wizard = useCertSetupWizard()
  wizard.applyExtraction(GROUNDED)
  wizard.state.identity = { name: 'AWS SAA', provider: 'AWS', code: 'SAA-C03' }
  wizard.state.confirmedSourceUrl = 'https://aws.amazon.com/guide'
  return wizard
}

describe('canCreateDraft', () => {
  it('is true when domain weights sum to 100', () => {
    const { state } = groundedWizard()
    expect(canCreateDraft(state)).toBe(true)
  })

  it('is false when domains are missing', () => {
    const { state } = useCertSetupWizard()
    expect(canCreateDraft(state)).toBe(false)
  })

  it('is false when domain weights do not sum to 100', () => {
    const { state, editFieldValue } = groundedWizard()
    editFieldValue('domains', [{ name: 'Secure', weight: 50 }])
    expect(canCreateDraft(state)).toBe(false)
  })
})

describe('buildDraftCreateBody', () => {
  it('maps identity, working values, source url and grounded/unverified provenance', () => {
    const { state } = groundedWizard()

    const body = buildDraftCreateBody(state)

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
  })

  it('marks admin-edited fields as manually confirmed in provenance', () => {
    const { state, editFieldValue } = groundedWizard()
    editFieldValue('questionCount', 65)

    const body = buildDraftCreateBody(state)

    expect(body.questionCount).toBe(65)
    expect(body.provenance.questionCount).toEqual({ manuallyConfirmed: true })
  })

  it('falls back to empty domains, provenance and source url before extraction', () => {
    const { state } = useCertSetupWizard()

    const body = buildDraftCreateBody(state)

    expect(body.domains).toEqual([])
    expect(body.provenance).toEqual({})
    expect(body.sourceUrl).toBe('')
  })
})
