import { z } from 'zod'
import type {
  CertificationDomain,
  CertificationFieldCitation,
  CertificationFieldProvenance,
} from '../certifications'
import type { ContentSourceType } from '../content-pipeline'

// `URL` is a runtime global in every target (Node and browsers) but the shared
// package's `lib` (ES2022 only) does not declare it.
declare const URL: { new (input: string): { host: string } }

export const CERT_EXTRACTION_QUEUE = 'cert-extraction'

export const CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT = 180

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Boundary choice: a cert verified exactly `intervalDays` ago is NOT yet due —
// only strictly-older-than-the-cutoff verifications fall due.
export function dueForReverification(
  verifiedAt: Date | string | null,
  now: Date,
  intervalDays: number,
): boolean {
  if (verifiedAt === null) {
    return true
  }
  const verifiedTime =
    typeof verifiedAt === 'string' ? new Date(verifiedAt).getTime() : verifiedAt.getTime()
  const cutoff = now.getTime() - intervalDays * MS_PER_DAY
  return verifiedTime < cutoff
}

export function validateDomainWeights(domains: CertificationDomain[]): boolean {
  if (domains.length === 0) {
    return false
  }
  return domains.reduce((sum, domain) => sum + domain.weight, 0) === 100
}

export function buildProvenanceMap(
  fields: CertExtractionFields,
  manualFields?: Set<string> | string[],
): Record<string, CertificationFieldProvenance> {
  const manual = manualFields instanceof Set ? manualFields : new Set(manualFields ?? [])
  const entries = Object.entries(fields) as [keyof CertExtractionFields, ExtractedField<unknown>][]
  return Object.fromEntries(
    entries.map(([key, field]) => {
      if (manual.has(key)) {
        return [key, { manuallyConfirmed: true }]
      }
      if ('citation' in field) {
        return [key, { url: field.citation.url, passage: field.citation.passage }]
      }
      return [key, { unverified: true }]
    }),
  )
}

export function rankDiscoveryCandidates(
  candidates: DiscoveryCandidate[],
  vendorDomains: string[],
): DiscoveryCandidate[] {
  const isVendor = (candidate: DiscoveryCandidate): boolean => {
    let host: string
    try {
      host = new URL(candidate.url).host
    } catch {
      return false
    }
    return isVendorHost(host, vendorDomains)
  }
  return candidates
    .map((candidate, index) => ({ candidate, index, vendor: isVendor(candidate) }))
    .sort((a, b) => (a.vendor === b.vendor ? a.index - b.index : a.vendor ? -1 : 1))
    .map((entry) => entry.candidate)
}

// Known documentation/certification hosts for the major cert vendors covered
// by this tool. The CertSearchPort adapter uses this to flag `official` on
// search results; `deriveVendorDomains` then feeds those hosts back into
// `rankDiscoveryCandidates` above so vendor pages rank first.
export const CERT_VENDOR_DOMAINS = [
  'aws.amazon.com',
  'learn.microsoft.com',
  'docs.microsoft.com',
  'cloud.google.com',
  'kubernetes.io',
  'training.linuxfoundation.org',
] as const

export function isVendorHost(host: string, domains: readonly string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

export const discoverSourcesRequestSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
})
export type DiscoverSourcesRequest = z.infer<typeof discoverSourcesRequestSchema>

export interface DiscoveryCandidate {
  url: string
  title: string
  snippet?: string
}

export interface SuggestedContentSource {
  url: string
  type: ContentSourceType
}

export interface DiscoverSourcesResponse {
  candidates: DiscoveryCandidate[]
  suggestedContentSources?: SuggestedContentSource[]
}

export const extractRequestSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  confirmedSourceUrl: z.string().url(),
})
export type ExtractRequest = z.infer<typeof extractRequestSchema>

export type ExtractedField<T> =
  | { value: T; citation: CertificationFieldCitation }
  | { unverified: true }

export interface CertExtractionFields {
  domains: ExtractedField<CertificationDomain[]>
  questionCount: ExtractedField<number>
  passingScore: ExtractedField<number>
  timeLimitMinutes: ExtractedField<number>
}

export type CertExtractionResult = { fields: CertExtractionFields } | null

export interface ExtractionEnqueuedResponse {
  jobId: string
  state: string
}

export interface ExtractionStatusResponse {
  state: string
  // The per-field extraction result (citations per field), or null while the job
  // has not produced a return value yet. Unwrapped from the worker's
  // `CertExtractionResult` envelope so callers read `fields.questionCount` directly.
  fields: CertExtractionFields | null
}

const certificationDomainSchema = z.object({
  name: z.string().min(1),
  weight: z.number().int(),
})

const certificationFieldCitationSchema = z.object({
  url: z.string().url(),
  passage: z.string(),
})

const certificationFieldProvenanceSchema = z.union([
  certificationFieldCitationSchema,
  z.object({ unverified: z.literal(true) }),
  z.object({ manuallyConfirmed: z.literal(true) }),
])

const certificationProvenanceMapSchema = z.record(z.string(), certificationFieldProvenanceSchema)

// Sum-to-100 validation is owned by a pure helper in group 2, not the schema —
// keeping this shape-only avoids double-ownership of the 422 mapping.
export const createCertificationRequestSchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  code: z.string().min(1),
  domains: z.array(certificationDomainSchema).min(1),
  questionCount: z.number().int().positive(),
  passingScore: z.number(),
  timeLimitMinutes: z.number().int().positive(),
  provenance: certificationProvenanceMapSchema,
  sourceUrl: z.string().url(),
})
export type CreateCertificationRequest = z.infer<typeof createCertificationRequestSchema>

export const reverifyCertificationRequestSchema = z.object({
  confirmedSourceUrl: z.string().url(),
  domains: z.array(certificationDomainSchema).min(1),
  questionCount: z.number().int().positive(),
  passingScore: z.number(),
  timeLimitMinutes: z.number().int().positive(),
  provenance: certificationProvenanceMapSchema,
})
export type ReverifyCertificationRequest = z.infer<typeof reverifyCertificationRequestSchema>

export interface DueForReverificationItem {
  id: string
  name: string
  code: string
  verifiedAt: string | null
  dueForReverification: true
}
