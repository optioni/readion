import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  CertificationFieldCitation,
  CertificationFieldManuallyConfirmed,
  CertificationFieldProvenance,
  CertificationFieldUnverified,
  CertificationProvenance,
} from '../certifications'
import type { CertificationDomain } from '../certifications'
import {
  buildProvenanceMap,
  CERT_EXTRACTION_QUEUE,
  CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT,
  type CertExtractionFields,
  type CertExtractionResult,
  type CreateCertificationRequest,
  createCertificationRequestSchema,
  type DiscoverSourcesRequest,
  type DiscoveryCandidate,
  discoverSourcesRequestSchema,
  type DueForReverificationItem,
  dueForReverification,
  type ExtractRequest,
  extractRequestSchema,
  rankDiscoveryCandidates,
  type ReverifyCertificationRequest,
  reverifyCertificationRequestSchema,
  validateDomainWeights,
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

describe('CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT', () => {
  it('defaults to 180 days', () => {
    expect(CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT).toBe(180)
  })
})

describe('dueForReverification', () => {
  const NOW = new Date('2026-06-27T00:00:00.000Z')

  it('is due when verifiedAt is null', () => {
    expect(dueForReverification(null, NOW, 180)).toBe(true)
  })

  it('is due when verifiedAt is older than the interval', () => {
    const verifiedAt = new Date('2025-12-09T00:00:00.000Z') // 200 days before NOW
    expect(dueForReverification(verifiedAt, NOW, 180)).toBe(true)
  })

  it('is not due when verifiedAt is fresh', () => {
    const verifiedAt = new Date('2026-06-17T00:00:00.000Z') // 10 days before NOW
    expect(dueForReverification(verifiedAt, NOW, 180)).toBe(false)
  })

  it('parses an ISO string verifiedAt', () => {
    expect(dueForReverification('2025-12-09T00:00:00.000Z', NOW, 180)).toBe(true)
    expect(dueForReverification('2026-06-17T00:00:00.000Z', NOW, 180)).toBe(false)
  })

  it('is not due exactly at the boundary (strictly older required)', () => {
    const verifiedAt = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000)
    expect(dueForReverification(verifiedAt, NOW, 180)).toBe(false)
  })
})

describe('validateDomainWeights', () => {
  it('is true when weights sum to exactly 100', () => {
    expect(validateDomainWeights([{ name: 'A', weight: 50 }, { name: 'B', weight: 50 }])).toBe(true)
  })

  it('is false when weights do not sum to 100', () => {
    expect(validateDomainWeights([{ name: 'A', weight: 50 }, { name: 'B', weight: 40 }])).toBe(false)
  })

  it('is false for an empty domains array', () => {
    expect(validateDomainWeights([])).toBe(false)
  })
})

describe('buildProvenanceMap', () => {
  const VENDOR = 'https://aws.amazon.com/certification/'
  const domains: CertificationDomain[] = [{ name: 'Cloud', weight: 100 }]

  const groundedFields: CertExtractionFields = {
    domains: { value: domains, citation: { url: VENDOR, passage: 'domain passage' } },
    questionCount: { value: 65, citation: { url: VENDOR, passage: 'question passage' } },
    passingScore: { value: 700, citation: { url: VENDOR, passage: 'score passage' } },
    timeLimitMinutes: { value: 90, citation: { url: VENDOR, passage: 'time passage' } },
  }

  it('maps grounded fields to citation entries', () => {
    expect(buildProvenanceMap(groundedFields)).toEqual({
      domains: { url: VENDOR, passage: 'domain passage' },
      questionCount: { url: VENDOR, passage: 'question passage' },
      passingScore: { url: VENDOR, passage: 'score passage' },
      timeLimitMinutes: { url: VENDOR, passage: 'time passage' },
    })
  })

  it('maps unverified fields to unverified entries', () => {
    const fields: CertExtractionFields = {
      ...groundedFields,
      passingScore: { unverified: true },
    }
    expect(buildProvenanceMap(fields).passingScore).toEqual({ unverified: true })
  })

  it('maps admin-confirmed fields to manuallyConfirmed entries, overriding extraction', () => {
    const fields: CertExtractionFields = {
      ...groundedFields,
      timeLimitMinutes: { unverified: true },
    }
    const result = buildProvenanceMap(fields, ['questionCount', 'timeLimitMinutes'])
    expect(result.questionCount).toEqual({ manuallyConfirmed: true })
    expect(result.timeLimitMinutes).toEqual({ manuallyConfirmed: true })
    expect(result.domains).toEqual({ url: VENDOR, passage: 'domain passage' })
  })

  it('accepts a Set of manual fields', () => {
    const result = buildProvenanceMap(groundedFields, new Set(['domains']))
    expect(result.domains).toEqual({ manuallyConfirmed: true })
  })
})

describe('rankDiscoveryCandidates', () => {
  const thirdParty: DiscoveryCandidate = { url: 'https://examtopics.com/aws', title: 'Exam Topics' }
  const vendor: DiscoveryCandidate = { url: 'https://aws.amazon.com/cert', title: 'AWS' }

  it('ranks vendor-domain candidates ahead of third-party ones', () => {
    const ranked = rankDiscoveryCandidates([thirdParty, vendor], ['amazon.com'])
    expect(ranked.map((c) => c.url)).toEqual([vendor.url, thirdParty.url])
  })

  it('preserves input order for ties (stable sort)', () => {
    const a: DiscoveryCandidate = { url: 'https://aws.amazon.com/a', title: 'A' }
    const b: DiscoveryCandidate = { url: 'https://docs.aws.amazon.com/b', title: 'B' }
    const ranked = rankDiscoveryCandidates([a, b], ['amazon.com'])
    expect(ranked.map((c) => c.url)).toEqual([a.url, b.url])
  })

  it('returns original order when vendorDomains is empty', () => {
    const ranked = rankDiscoveryCandidates([thirdParty, vendor], [])
    expect(ranked.map((c) => c.url)).toEqual([thirdParty.url, vendor.url])
  })

  it('treats unparseable URLs as third-party', () => {
    const broken: DiscoveryCandidate = { url: 'not a url', title: 'Broken' }
    const ranked = rankDiscoveryCandidates([broken, vendor], ['amazon.com'])
    expect(ranked.map((c) => c.url)).toEqual([vendor.url, broken.url])
  })
})
