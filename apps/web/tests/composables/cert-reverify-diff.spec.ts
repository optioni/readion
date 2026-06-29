import type { CertExtractionFields } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { buildCertDiff, buildReverifyBody } from '~/composables/certReverifyDiff'
import type { CertificationResponseDto } from '~~/src/api/model/certificationResponseDto'

const CURRENT: CertificationResponseDto = {
  id: 'c0000000-0000-0000-0000-000000000001',
  name: 'AWS Certified Solutions Architect — Associate',
  provider: 'AWS',
  code: 'SAA-C03',
  domains: [
    { name: 'Secure Architectures', weight: 30 },
    { name: 'Resilient Architectures', weight: 26 },
    { name: 'High-Performing Architectures', weight: 24 },
    { name: 'Cost-Optimized Architectures', weight: 20 },
  ],
  questionCount: 65,
  passingScore: 72,
  timeLimitMinutes: 130,
  state: 'live',
}

const CITATION = {
  url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
  passage: 'a minimum passing score of 720 (~67%)',
}

// passingScore changed (72 -> 67), questionCount unverified (keep current 65),
// domains + timeLimit grounded but unchanged.
const EXTRACTION_FIELDS: CertExtractionFields = {
  domains: {
    value: CURRENT.domains,
    citation: { url: CITATION.url, passage: 'Domain breakdown' },
  },
  questionCount: { unverified: true },
  passingScore: { value: 67, citation: CITATION },
  timeLimitMinutes: {
    value: 130,
    citation: { url: CITATION.url, passage: '130 minutes' },
  },
}

describe('buildCertDiff', () => {
  it('marks a grounded numeric field whose value differs as changed', () => {
    const diff = buildCertDiff(CURRENT, EXTRACTION_FIELDS)
    const passing = diff.rows.find((row) => row.key === 'passingScore')
    expect(passing).toMatchObject({
      current: '72',
      proposed: '67',
      changed: true,
      unverified: false,
    })
    expect(diff.proposed.passingScore).toBe(67)
  })

  it('marks a grounded numeric field whose value matches as unchanged', () => {
    const diff = buildCertDiff(CURRENT, EXTRACTION_FIELDS)
    const timeLimit = diff.rows.find((row) => row.key === 'timeLimitMinutes')
    expect(timeLimit).toMatchObject({ current: '130', proposed: '130', changed: false })
    expect(diff.proposed.timeLimitMinutes).toBe(130)
  })

  it('keeps the current value for an unverified field and never flags it changed', () => {
    const diff = buildCertDiff(CURRENT, EXTRACTION_FIELDS)
    const questionCount = diff.rows.find((row) => row.key === 'questionCount')
    expect(questionCount).toMatchObject({
      current: '65',
      proposed: '65',
      changed: false,
      unverified: true,
    })
    expect(diff.proposed.questionCount).toBe(65)
  })

  it('renders domains as formatted names with weights and detects an unchanged set', () => {
    const diff = buildCertDiff(CURRENT, EXTRACTION_FIELDS)
    const domains = diff.rows.find((row) => row.key === 'domains')
    expect(domains?.current).toContain('Secure Architectures (30%)')
    expect(domains?.changed).toBe(false)
    expect(diff.proposed.domains).toHaveLength(4)
  })

  it('detects a changed domain set', () => {
    const fields: CertExtractionFields = {
      ...EXTRACTION_FIELDS,
      domains: {
        value: [
          { name: 'Secure Architectures', weight: 40 },
          { name: 'Resilient Architectures', weight: 26 },
          { name: 'High-Performing Architectures', weight: 24 },
          { name: 'Cost-Optimized Architectures', weight: 10 },
        ],
        citation: { url: CITATION.url, passage: 'reweighted' },
      },
    }
    const diff = buildCertDiff(CURRENT, fields)
    const domains = diff.rows.find((row) => row.key === 'domains')
    expect(domains?.changed).toBe(true)
    expect(diff.hasChanges).toBe(true)
  })

  it('reports no changes when every grounded value matches and others are unverified', () => {
    const fields: CertExtractionFields = {
      ...EXTRACTION_FIELDS,
      passingScore: { value: 72, citation: CITATION },
    }
    const diff = buildCertDiff(CURRENT, fields)
    expect(diff.hasChanges).toBe(false)
  })

  it('uses a grounded numeric value while keeping current values for unverified numerics', () => {
    const fields: CertExtractionFields = {
      domains: { unverified: true },
      questionCount: { value: 70, citation: CITATION },
      passingScore: { unverified: true },
      timeLimitMinutes: { unverified: true },
    }
    const diff = buildCertDiff(CURRENT, fields)

    const questionCount = diff.rows.find((row) => row.key === 'questionCount')
    expect(questionCount).toMatchObject({ proposed: '70', changed: true, unverified: false })
    expect(diff.proposed.questionCount).toBe(70)

    const passingScore = diff.rows.find((row) => row.key === 'passingScore')
    expect(passingScore).toMatchObject({ proposed: '72', changed: false, unverified: true })
    expect(diff.proposed.passingScore).toBe(72)

    const timeLimit = diff.rows.find((row) => row.key === 'timeLimitMinutes')
    expect(timeLimit?.unverified).toBe(true)
    expect(diff.proposed.timeLimitMinutes).toBe(130)
  })

  it('keeps the current value when domains are unverified', () => {
    const fields: CertExtractionFields = {
      ...EXTRACTION_FIELDS,
      domains: { unverified: true },
    }
    const diff = buildCertDiff(CURRENT, fields)
    const domains = diff.rows.find((row) => row.key === 'domains')
    expect(domains?.unverified).toBe(true)
    expect(domains?.changed).toBe(false)
    expect(diff.proposed.domains).toEqual(CURRENT.domains)
  })
})

describe('buildReverifyBody', () => {
  it('emits the proposed values, the confirmed source url, and a provenance map', () => {
    const diff = buildCertDiff(CURRENT, EXTRACTION_FIELDS)
    const body = buildReverifyBody(CITATION.url, diff.proposed, EXTRACTION_FIELDS)

    expect(body).toMatchObject({
      confirmedSourceUrl: CITATION.url,
      questionCount: 65,
      passingScore: 67,
      timeLimitMinutes: 130,
    })
    expect(body.domains).toHaveLength(4)
    expect(body.provenance.passingScore).toEqual({
      url: CITATION.url,
      passage: CITATION.passage,
    })
    expect(body.provenance.questionCount).toEqual({ unverified: true })
  })

  it('marks admin-overridden fields as manually confirmed in provenance', () => {
    const diff = buildCertDiff(CURRENT, EXTRACTION_FIELDS)
    const body = buildReverifyBody(CITATION.url, diff.proposed, EXTRACTION_FIELDS, ['passingScore'])
    expect(body.provenance.passingScore).toEqual({ manuallyConfirmed: true })
  })
})
