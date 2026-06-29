import type {
  CertExtractionFields,
  CertificationDomain,
  ExtractedField,
  SuggestedContentSource,
} from '@readion/shared'
import { extractRequestSchema } from '@readion/shared'
import { reactive } from 'vue'
import { readDataEnvelope } from '~/composables/adminEnvelope'
import { certSetupControllerExtract } from '~~/src/api/cert-setup/cert-setup'

const jsonHeaders = { 'Content-Type': 'application/json' }

export type CertExtractionFieldKey = keyof CertExtractionFields

// Working values the admin reviews/edits before submit. Initialised from each grounded
// field's `value`; unverified fields start null and await admin input. Group 8 reads
// these to build the `POST /admin/certifications` create body.
export interface CertSetupFieldValues {
  domains: CertificationDomain[] | null
  questionCount: number | null
  passingScore: number | null
  timeLimitMinutes: number | null
}

// Shared wizard state across the four cert-setup steps. Step 1 (group 6) writes
// `name`, `code`, `confirmedSourceUrl` and `extractionJobId`. Step 2 (group 7) polls
// `extractionJobId`, stores the grounded `fields`, the editable `fieldValues`, the
// admin-flagged/edited `manualFields`, and the admin-entered `identity`. Group 8 reads
// `fieldValues` + `identity` + `manualFields` + `confirmedSourceUrl` to build the
// create body — so extend this shape rather than replacing it.
export interface CertSetupWizardState {
  step: 1 | 2 | 3 | 4
  name: string
  code: string // optional discovery code; '' when empty
  confirmedSourceUrl: string | null
  extractionJobId: string | null // set in step 1 (group 6) via confirmSource below
  // --- added by group 7 (step 2 extraction review) ---
  fields: CertExtractionFields | null // raw grounded|unverified extraction result
  fieldValues: CertSetupFieldValues // editable working values used to build the create body
  manualFields: CertExtractionFieldKey[] // keys the admin edited/flagged → provenance { manuallyConfirmed }
  identity: { name: string; provider: string; code: string } // admin-entered cert identity
  // --- added by group 8 (step 3 sources/coverage + step 4 draft submit) ---
  suggestedContentSources: SuggestedContentSource[] // captured from discovery; step 3 registers/discards
  createdCertId: string | null // the created draft cert id; gates coverage + sources sub-steps
}

export interface CertSetupWizard {
  state: CertSetupWizardState
  confirmSource: (url: string) => Promise<void>
  applyExtraction: (fields: CertExtractionFields) => void
  editFieldValue: <K extends CertExtractionFieldKey>(key: K, value: CertSetupFieldValues[K]) => void
  flagField: (key: CertExtractionFieldKey) => void
  registerCreatedDraft: (certId: string) => void
}

function isGrounded<T>(
  field: ExtractedField<T>,
): field is { value: T; citation: { url: string; passage: string } } {
  return 'citation' in field
}

function groundedValue<T>(field: ExtractedField<T>): T | null {
  return isGrounded(field) ? field.value : null
}

export function useCertSetupWizard(): CertSetupWizard {
  const state = reactive<CertSetupWizardState>({
    step: 1,
    name: '',
    code: '',
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
  })

  // Step 1 confirm action: persist the confirmed url, kick off grounded extraction,
  // then advance to step 2. Group 7 owns the poll + render of the extraction result;
  // it reads `state.extractionJobId` (plus `state.name`/`state.code`) to do so.
  async function confirmSource(url: string): Promise<void> {
    const body = extractRequestSchema.parse({
      name: state.name,
      ...(state.code ? { code: state.code } : {}),
      confirmedSourceUrl: url,
    })
    state.confirmedSourceUrl = url
    const response = await certSetupControllerExtract({
      headers: jsonHeaders,
      body: JSON.stringify(body),
    })
    state.extractionJobId = readDataEnvelope<{ jobId: string; state: string }>(response).jobId
    state.step = 2
  }

  // Called once when the poll first yields a non-null `fields`. Stores the raw result
  // and seeds the editable working values from grounded fields (unverified → null).
  function applyExtraction(fields: CertExtractionFields): void {
    if (state.fields) return
    state.fields = fields
    state.fieldValues = {
      domains: groundedValue(fields.domains),
      questionCount: groundedValue(fields.questionCount),
      passingScore: groundedValue(fields.passingScore),
      timeLimitMinutes: groundedValue(fields.timeLimitMinutes),
    }
  }

  function markManual(key: CertExtractionFieldKey): void {
    if (!state.manualFields.includes(key)) state.manualFields.push(key)
  }

  // Admin edited a field's working value (grounded override or unverified entry):
  // record the value and flag the field as manually confirmed for provenance.
  function editFieldValue<K extends CertExtractionFieldKey>(
    key: K,
    value: CertSetupFieldValues[K],
  ): void {
    state.fieldValues[key] = value
    markManual(key)
  }

  // Per-field "Flag as uncertain": client-side review state that also marks the field
  // manual so downstream provenance reflects the admin's judgement.
  function flagField(key: CertExtractionFieldKey): void {
    markManual(key)
  }

  // Step 4 success: store the created draft's id and advance to step 3 (sources +
  // read-only coverage). Keeping the transition here so step components stay declarative.
  function registerCreatedDraft(certId: string): void {
    state.createdCertId = certId
    state.step = 3
  }

  return { state, confirmSource, applyExtraction, editFieldValue, flagField, registerCreatedDraft }
}
