import { extractRequestSchema } from '@readion/shared'
import { reactive } from 'vue'
import { readDataEnvelope } from '~/composables/adminEnvelope'
import { certSetupControllerExtract } from '~~/src/api/cert-setup/cert-setup'

const jsonHeaders = { 'Content-Type': 'application/json' }

// Shared wizard state across the four cert-setup steps. Step 1 (this group) writes
// `name`, `code`, `confirmedSourceUrl` and `extractionJobId`. Steps 2–4 (groups 7, 8)
// READ these fields — group 7 polls `extractionJobId`, group 8 reads `confirmedSourceUrl`
// and the extracted/identity fields it appends here — so extend this shape rather than
// replacing it.
export interface CertSetupWizardState {
  step: 1 | 2 | 3 | 4
  name: string
  code: string // optional code; '' when empty
  confirmedSourceUrl: string | null
  extractionJobId: string | null // set in step 2 (group 7) via confirmSource below
  // fields/manualFields/identity/createdCertId added by groups 7, 8 — extend here.
}

export interface CertSetupWizard {
  state: CertSetupWizardState
  confirmSource: (url: string) => Promise<void>
}

export function useCertSetupWizard(): CertSetupWizard {
  const state = reactive<CertSetupWizardState>({
    step: 1,
    name: '',
    code: '',
    confirmedSourceUrl: null,
    extractionJobId: null,
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

  return { state, confirmSource }
}
