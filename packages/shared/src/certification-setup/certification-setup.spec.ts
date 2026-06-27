import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  CertificationFieldCitation,
  CertificationFieldManuallyConfirmed,
  CertificationFieldProvenance,
  CertificationFieldUnverified,
  CertificationProvenance,
} from '../certifications'
import {
  CERT_EXTRACTION_QUEUE,
  type CertExtractionResult,
  type CreateCertificationRequest,
  createCertificationRequestSchema,
  type DiscoverSourcesRequest,
  discoverSourcesRequestSchema,
  type DueForReverificationItem,
  type ExtractRequest,
  extractRequestSchema,
  type ReverifyCertificationRequest,
  reverifyCertificationRequestSchema,
} from './index'

const VENDOR_URL = 'https://aws.amazon.com/certification/certified-cloud-practitioner/'

const VALID_DOMAINS = [
  { name: 'Cloud Concepts', weight: 24 },
  { name: 'Security and Compliance', weight: 30 },
  { name: 'Cloud Technology and Services', weight: 34 },
  { name: 'Billing, Pricing, and Support', weight: 12 },
]

const VALID_PROVENANCE = {
  name: { url: VENDOR_URL, passage: 'AWS Certified Cloud Practitioner' },
  questionCount: { url: VENDOR_URL, passage: 'The exam contains 65 questions.' },
}

describe('CERT_EXTRACTION_QUEUE', () => {
  it('resolves to the cross-app queue name literal', () => {
    expect(CERT_EXTRACTION_QUEUE).toBe('cert-extraction')
  })
})

describe('discoverSourcesRequestSchema', () => {
  it('parses a valid request with optional code', () => {
    const parsed = discoverSourcesRequestSchema.parse({
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
    })
    expect(parsed.name).toBe('AWS Certified Cloud Practitioner')
    expect(parsed.code).toBe('CLF-C02')
  })

  it('parses a valid request without code', () => {
    const parsed = discoverSourcesRequestSchema.parse({ name: 'Azure Fundamentals' })
    expect(parsed.name).toBe('Azure Fundamentals')
  })

  it('rejects an empty name', () => {
    expect(discoverSourcesRequestSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('infers the DiscoverSourcesRequest type', () => {
    expectTypeOf<DiscoverSourcesRequest>().toMatchTypeOf<{ name: string; code?: string }>()
  })
})

describe('extractRequestSchema', () => {
  it('parses a valid request', () => {
    const parsed = extractRequestSchema.parse({
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
      confirmedSourceUrl: VENDOR_URL,
    })
    expect(parsed.confirmedSourceUrl).toBe(VENDOR_URL)
  })

  it('rejects a non-url confirmed source', () => {
    expect(
      extractRequestSchema.safeParse({
        name: 'AWS Certified Cloud Practitioner',
        confirmedSourceUrl: 'not-a-url',
      }).success,
    ).toBe(false)
  })

  it('rejects a missing name', () => {
    expect(
      extractRequestSchema.safeParse({ confirmedSourceUrl: VENDOR_URL }).success,
    ).toBe(false)
  })

  it('infers the ExtractRequest type', () => {
    expectTypeOf<ExtractRequest>().toMatchTypeOf<{
      name: string
      code?: string
      confirmedSourceUrl: string
    }>()
  })
})

describe('createCertificationRequestSchema', () => {
  const validPayload = {
    name: 'AWS Certified Cloud Practitioner',
    provider: 'AWS',
    code: 'CLF-C02',
    domains: VALID_DOMAINS,
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: VALID_PROVENANCE,
    sourceUrl: VENDOR_URL,
  }

  it('parses a valid create payload', () => {
    const parsed = createCertificationRequestSchema.parse(validPayload)
    expect(parsed.code).toBe('CLF-C02')
    expect(parsed.domains).toHaveLength(4)
  })

  it('rejects a non-url sourceUrl', () => {
    expect(
      createCertificationRequestSchema.safeParse({ ...validPayload, sourceUrl: 'nope' }).success,
    ).toBe(false)
  })

  it('rejects a non-positive questionCount', () => {
    expect(
      createCertificationRequestSchema.safeParse({ ...validPayload, questionCount: 0 }).success,
    ).toBe(false)
  })

  it('rejects an empty domains array having no entries name', () => {
    expect(
      createCertificationRequestSchema.safeParse({
        ...validPayload,
        domains: [{ name: '', weight: 100 }],
      }).success,
    ).toBe(false)
  })

  it('infers the CreateCertificationRequest type', () => {
    expectTypeOf<CreateCertificationRequest>().toMatchTypeOf<{
      name: string
      provider: string
      code: string
      questionCount: number
      passingScore: number
      timeLimitMinutes: number
      sourceUrl: string
    }>()
  })
})

describe('reverifyCertificationRequestSchema', () => {
  const validPayload = {
    confirmedSourceUrl: VENDOR_URL,
    domains: VALID_DOMAINS,
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: VALID_PROVENANCE,
  }

  it('parses a valid reverify payload', () => {
    const parsed = reverifyCertificationRequestSchema.parse(validPayload)
    expect(parsed.confirmedSourceUrl).toBe(VENDOR_URL)
  })

  it('rejects a non-url confirmed source', () => {
    expect(
      reverifyCertificationRequestSchema.safeParse({
        ...validPayload,
        confirmedSourceUrl: 'nope',
      }).success,
    ).toBe(false)
  })

  it('infers the ReverifyCertificationRequest type', () => {
    expectTypeOf<ReverifyCertificationRequest>().toMatchTypeOf<{
      confirmedSourceUrl: string
      questionCount: number
      passingScore: number
      timeLimitMinutes: number
    }>()
  })
})

describe('DueForReverificationItem', () => {
  it('has the documented field shape', () => {
    expectTypeOf<DueForReverificationItem>().toEqualTypeOf<{
      id: string
      name: string
      code: string
      verifiedAt: string | null
      dueForReverification: true
    }>()
  })
})

describe('provenance field-state union', () => {
  it('round-trips a citation field state through JSON', () => {
    const citation: CertificationFieldCitation = { url: VENDOR_URL, passage: 'p' }
    const value: CertificationFieldProvenance = citation
    expect(JSON.parse(JSON.stringify(value))).toEqual(citation)
  })

  it('round-trips an unverified field state through JSON', () => {
    const value: CertificationFieldUnverified = { unverified: true }
    expect(JSON.parse(JSON.stringify(value))).toEqual({ unverified: true })
  })

  it('round-trips a manually-confirmed field state through JSON', () => {
    const value: CertificationFieldManuallyConfirmed = { manuallyConfirmed: true }
    expect(JSON.parse(JSON.stringify(value))).toEqual({ manuallyConfirmed: true })
  })

  it('round-trips a full provenance map with all three states', () => {
    const provenance: CertificationProvenance = {
      name: { url: VENDOR_URL, passage: 'name' },
      questionCount: { unverified: true },
      passingScore: { manuallyConfirmed: true },
    }
    expect(JSON.parse(JSON.stringify(provenance))).toEqual(provenance)
  })

  it('still allows the verified sentinel string', () => {
    const provenance: CertificationProvenance = 'verified'
    expect(JSON.parse(JSON.stringify(provenance))).toBe('verified')
  })
})

describe('CertExtractionResult', () => {
  it('round-trips a grounded and unverified field mix through JSON', () => {
    const result: CertExtractionResult = {
      fields: {
        domains: { value: VALID_DOMAINS, citation: { url: VENDOR_URL, passage: 'd' } },
        questionCount: { value: 65, citation: { url: VENDOR_URL, passage: 'q' } },
        passingScore: { unverified: true },
        timeLimitMinutes: { value: 90, citation: { url: VENDOR_URL, passage: 't' } },
      },
    }
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('round-trips a null extraction result', () => {
    const result: CertExtractionResult = null
    expect(JSON.parse(JSON.stringify(result))).toBeNull()
  })
})
