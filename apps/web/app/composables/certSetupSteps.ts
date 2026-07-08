export type CertSetupStep = 1 | 2 | 3 | 4

// Single source of truth for the cert-setup wizard's step labels: `SetupHeader`
// derives its `Step N of 4 · <name>` indicator and progress bar from this list
// rather than duplicating labels/count next to the wizard's own step state.
export const CERT_SETUP_STEPS = [
  'Source search',
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
