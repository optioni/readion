import type { CertExtractionFields } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'

const CITATION = { url: 'https://example.com/guide', passage: 'passage' }

const GROUNDED: CertExtractionFields = {
  domains: { value: [{ name: 'Cloud', weight: 100 }], citation: CITATION },
  questionCount: { unverified: true },
  passingScore: { value: 67, citation: CITATION },
  timeLimitMinutes: { value: 130, citation: CITATION },
}

describe('useCertSetupWizard extraction state', () => {
  it('seeds working values from grounded fields and leaves unverified ones null', () => {
    const { state, applyExtraction } = useCertSetupWizard()

    applyExtraction(GROUNDED)

    expect(state.fields).toEqual(GROUNDED)
    expect(state.fieldValues).toEqual({
      domains: [{ name: 'Cloud', weight: 100 }],
      questionCount: null,
      passingScore: 67,
      timeLimitMinutes: 130,
    })
  })

  it('applies extraction only once — a later poll result does not clobber edits', () => {
    const { state, applyExtraction, editFieldValue } = useCertSetupWizard()

    applyExtraction(GROUNDED)
    editFieldValue('passingScore', 72)

    applyExtraction({
      ...GROUNDED,
      passingScore: { value: 50, citation: CITATION },
    })

    expect(state.fieldValues.passingScore).toBe(72)
  })

  it('deduplicates manual fields across edits and flags', () => {
    const { state, applyExtraction, editFieldValue, flagField } = useCertSetupWizard()

    applyExtraction(GROUNDED)
    editFieldValue('passingScore', 72)
    flagField('passingScore')
    flagField('timeLimitMinutes')

    expect(state.manualFields).toEqual(['passingScore', 'timeLimitMinutes'])
  })
})
