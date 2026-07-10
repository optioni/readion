export type CertSetupStep = 1 | 2 | 3 | 4 | 5

// Single source of truth for the cert-setup wizard's step labels: `SetupHeader` derives its
// `Step N of 5 · <name>` indicator and progress bar from this list rather than duplicating
// labels/count next to the wizard's own step state. Step 5 ("Review & publish") has no distinct
// screen in this app — draft creation auto-publishes — so the wizard never actually reaches it;
// it stays in the count so the header's fraction matches the design's 5-step flow.
export const CERT_SETUP_STEPS = [
  'Identify certification',
  'Source confirmation',
  'Field extraction',
  'Content sources',
  'Review & publish',
] as const

export const CERT_SETUP_STEP_COUNT = CERT_SETUP_STEPS.length

export function certSetupStepLabel(step: CertSetupStep): string {
  return CERT_SETUP_STEPS[step - 1] ?? ''
}

export function certSetupStepProgress(step: CertSetupStep): number {
  return (step / CERT_SETUP_STEP_COUNT) * 100
}
