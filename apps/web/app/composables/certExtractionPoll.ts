import type { ExtractionStatusResponse } from '@readion/shared'

// BullMQ job states that will not produce further output. A `completed` state with no `fields` means
// the worker returned without a result — treat it as an error, not an in-flight job.
const TERMINAL_STATES = new Set(['completed', 'failed'])

// The cert-setup wizard and the re-verification flow now learn of completion over SSE (see the
// sse-extraction-events change), so the interval-poll loop and its consecutive-failure cap are gone.
// This helper is retained for the single status-GET fallback both flows still make: it decides whether
// a fetched status is terminal but produced no fields.
export function isTerminalWithoutFields(data: ExtractionStatusResponse | undefined): boolean {
  return Boolean(data) && !data?.fields && TERMINAL_STATES.has(data?.state ?? '')
}
