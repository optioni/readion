import type {
  CertExtractionFields,
  CertificationDomain,
  DiscoveryCandidate,
  ExtractedField,
  SuggestedContentSource,
} from '@readion/shared'
import { reactive } from 'vue'
import { discoverCertSources, enqueueCertExtraction } from '~/composables/certSetupKickoff'

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

// Shared wizard state across the five cert-setup steps (fix-web-admin-parity's 5-step restructure:
// a standalone step-1 "Identify certification" screen now precedes source confirmation). Step 1
// writes `name`, `code`, `identity`, `knownSourceUrl`, and kicks off discovery into
// `discoveryCandidates`. Step 2 confirms a source into `confirmedSourceUrl` + `extractionJobId`.
// Step 3 polls `extractionJobId`, stores the grounded `fields`, the editable `fieldValues`, and the
// admin-flagged/edited `manualFields`. Step 4 reads `fieldValues` + `identity` + `manualFields` +
// `confirmedSourceUrl` to build the create body — so extend this shape rather than replacing it.
export interface CertSetupWizardState {
  step: 1 | 2 | 3 | 4
  name: string
  code: string // required exam code, entered at step 1
  knownSourceUrl: string | null // optional known-URL entered upfront at step 1
  discoveryCandidates: DiscoveryCandidate[] // fetched when step 1 submits, rendered at step 2
  confirmedSourceUrl: string | null
  extractionJobId: string | null // set at step 2 via confirmSource below
  // --- extraction review (step 3) ---
  fields: CertExtractionFields | null // raw grounded|unverified extraction result
  fieldValues: CertSetupFieldValues // editable working values used to build the create body
  manualFields: CertExtractionFieldKey[] // keys the admin edited/flagged → provenance { manuallyConfirmed }
  identity: { name: string; provider: string; code: string } // admin-entered cert identity
  // --- sources/coverage + draft submit (step 4) ---
  suggestedContentSources: SuggestedContentSource[] // captured from discovery; step 4 registers/discards
  createdCertId: string | null // the created draft cert id; gates coverage + sources sub-steps
}

export interface CertSetupWizard {
  state: CertSetupWizardState
  submitIdentity: (
    name: string,
    code: string,
    provider: string,
    knownSourceUrl: string,
  ) => Promise<void>
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
    knownSourceUrl: null,
    discoveryCandidates: [],
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

  // Step 1 submit: persist the entered identity, kick off discovery, then advance to step 2
  // (source confirmation) with the fetched candidates already in state — the search "kicks off
  // on identify → confirmation" rather than requiring a second manual trigger.
  async function submitIdentity(
    name: string,
    code: string,
    provider: string,
    knownSourceUrl: string,
  ): Promise<void> {
    state.name = name
    state.code = code
    state.identity = { name, provider, code }
    state.knownSourceUrl = knownSourceUrl || null
    const discovered = await discoverCertSources(name, code)
    state.discoveryCandidates = discovered.candidates
    state.suggestedContentSources = discovered.suggestedContentSources ?? []
    state.step = 2
  }

  // Step 2 confirm action: persist the confirmed url, kick off grounded extraction,
  // then advance to step 3. Step 3 owns the poll + render of the extraction result;
  // it reads `state.extractionJobId` (plus `state.name`/`state.code`) to do so.
  async function confirmSource(url: string): Promise<void> {
    state.confirmedSourceUrl = url
    state.extractionJobId = await enqueueCertExtraction(state.name, state.code, url)
    state.step = 3
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

  // Draft-submit success (end of step 3): store the created draft's id and advance to step 4
  // (sources + read-only coverage). Keeping the transition here so step components stay declarative.
  function registerCreatedDraft(certId: string): void {
    state.createdCertId = certId
    state.step = 4
  }

  return {
    state,
    submitIdentity,
    confirmSource,
    applyExtraction,
    editFieldValue,
    flagField,
    registerCreatedDraft,
  }
}
