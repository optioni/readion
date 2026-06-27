import { z } from 'zod'
import type { CertificationDomain, CertificationFieldCitation } from '../certifications'
import type { ContentSourceType } from '../content-pipeline'

export const CERT_EXTRACTION_QUEUE = 'cert-extraction'

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
  fields: CertExtractionResult
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
