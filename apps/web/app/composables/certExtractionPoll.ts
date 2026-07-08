import type { ExtractionStatusResponse } from '@readion/shared'

const POLL_INTERVAL_MS = 1500

// After this many consecutive failed fetches (e.g. a rate limit or a network
// blip), stop polling instead of hammering the endpoint forever. Without this a
// 429 leaves `data` undefined, which would otherwise keep the poll running and
// deepen the rate limit — a self-reinforcing loop.
const MAX_CONSECUTIVE_FAILURES = 5

// BullMQ job states that will not produce further output. A `completed` state with
// no `fields` means the worker returned without a result — treat it as an error, not
// an in-flight poll, so we stop instead of looping forever.
const TERMINAL_STATES = new Set(['completed', 'failed'])

// vue-query `refetchInterval` decision: keep polling (number) while the job is still
// running and has not produced fields, stop (false) once fields arrive, the job
// reaches a terminal state without them, or the fetch keeps failing.
export function nextRefetchInterval(
  data: ExtractionStatusResponse | undefined,
  failureCount = 0,
): number | false {
  if (failureCount >= MAX_CONSECUTIVE_FAILURES) return false
  if (!data) return POLL_INTERVAL_MS
  if (data.fields) return false
  return TERMINAL_STATES.has(data.state) ? false : POLL_INTERVAL_MS
}

export function isTerminalWithoutFields(data: ExtractionStatusResponse | undefined): boolean {
  return Boolean(data) && !data?.fields && TERMINAL_STATES.has(data?.state ?? '')
}
