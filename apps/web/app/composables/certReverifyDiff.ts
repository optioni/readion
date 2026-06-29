import type {
  CertExtractionFields,
  CertificationDomain,
  ExtractedField,
  ReverifyCertificationRequest,
} from '@readion/shared'
import { buildProvenanceMap } from '@readion/shared'
import type { CertificationResponseDto } from '~~/src/api/model/certificationResponseDto'

export type ReverifyFieldKey = 'domains' | 'questionCount' | 'passingScore' | 'timeLimitMinutes'

// The accepted values submitted to `POST /admin/certifications/:id/reverify`. Every field is
// present: a grounded extraction supplies the proposed value, an unverified one keeps the current
// (already-confirmed, since the cert is live) value — so the reverify schema always validates.
export interface CertProposedValues {
  domains: CertificationDomain[]
  questionCount: number
  passingScore: number
  timeLimitMinutes: number
}

export interface CertDiffRow {
  key: ReverifyFieldKey
  label: string
  current: string
  proposed: string
  changed: boolean
  unverified: boolean
}

export interface CertDiff {
  rows: CertDiffRow[]
  proposed: CertProposedValues
  hasChanges: boolean
}

const FIELD_LABELS: Record<ReverifyFieldKey, string> = {
  domains: 'Domains',
  questionCount: 'Question count',
  passingScore: 'Passing score (%)',
  timeLimitMinutes: 'Time limit (minutes)',
}

function isGrounded<T>(
  field: ExtractedField<T>,
): field is { value: T; citation: { url: string; passage: string } } {
  return 'citation' in field
}

function formatDomains(domains: CertificationDomain[]): string {
  return domains.map((domain) => `${domain.name} (${domain.weight}%)`).join(', ')
}

function domainRow(
  current: CertificationDomain[],
  field: ExtractedField<CertificationDomain[]>,
  proposed: CertificationDomain[],
): CertDiffRow {
  return {
    key: 'domains',
    label: FIELD_LABELS.domains,
    current: formatDomains(current),
    proposed: formatDomains(proposed),
    changed: JSON.stringify(current) !== JSON.stringify(proposed),
    unverified: !isGrounded(field),
  }
}

function numericRow(
  key: Exclude<ReverifyFieldKey, 'domains'>,
  current: number,
  field: ExtractedField<number>,
  proposed: number,
): CertDiffRow {
  return {
    key,
    label: FIELD_LABELS[key],
    current: String(current),
    proposed: String(proposed),
    changed: current !== proposed,
    unverified: !isGrounded(field),
  }
}

export function buildCertDiff(
  current: CertificationResponseDto,
  fields: CertExtractionFields,
): CertDiff {
  const proposed: CertProposedValues = {
    domains: isGrounded(fields.domains) ? fields.domains.value : current.domains,
    questionCount: isGrounded(fields.questionCount)
      ? fields.questionCount.value
      : current.questionCount,
    passingScore: isGrounded(fields.passingScore)
      ? fields.passingScore.value
      : current.passingScore,
    timeLimitMinutes: isGrounded(fields.timeLimitMinutes)
      ? fields.timeLimitMinutes.value
      : current.timeLimitMinutes,
  }
  const rows: CertDiffRow[] = [
    domainRow(current.domains, fields.domains, proposed.domains),
    numericRow(
      'questionCount',
      current.questionCount,
      fields.questionCount,
      proposed.questionCount,
    ),
    numericRow('passingScore', current.passingScore, fields.passingScore, proposed.passingScore),
    numericRow(
      'timeLimitMinutes',
      current.timeLimitMinutes,
      fields.timeLimitMinutes,
      proposed.timeLimitMinutes,
    ),
  ]
  return { rows, proposed, hasChanges: rows.some((row) => row.changed) }
}

export function buildReverifyBody(
  confirmedSourceUrl: string,
  proposed: CertProposedValues,
  fields: CertExtractionFields,
  manualFields: ReverifyFieldKey[] = [],
): ReverifyCertificationRequest {
  return {
    confirmedSourceUrl,
    domains: proposed.domains,
    questionCount: proposed.questionCount,
    passingScore: proposed.passingScore,
    timeLimitMinutes: proposed.timeLimitMinutes,
    provenance: buildProvenanceMap(fields, manualFields),
  }
}
