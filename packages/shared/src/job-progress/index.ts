// Reusable job-progress SSE contract. A background (BullMQ) job pushes its status and terminal result
// to an authenticated browser over Server-Sent Events instead of being polled. Delivered first for
// certification extraction; mock-exam prep and session generation can adopt the same contract.

// BullMQ job states relevant to progress reporting.
export const jobProgressStates = ['waiting', 'active', 'completed', 'failed'] as const
export type JobProgressState = (typeof jobProgressStates)[number]

// A single job-progress SSE payload, keyed by BullMQ job id. `result` is present only once the job has
// reached a terminal state and produced a return value.
export interface JobProgressEvent<TResult = unknown> {
  jobId: string
  state: JobProgressState | string
  result?: TResult
}

const TERMINAL_STATES = new Set<string>(['completed', 'failed'])

// The two terminal BullMQ states — no further progress will be emitted once reached.
export function isTerminalJobState(state: string): boolean {
  return TERMINAL_STATES.has(state)
}

// SSE heartbeat comment written to keep an idle stream alive through connection reapers.
export const JOB_PROGRESS_HEARTBEAT = ': keepalive\n\n'

// Frames a job-progress event as an unnamed SSE `data:` line (default `message` event), matching the
// agent chat stream so the shared web `EventSource` consumer needs no per-stream event handling.
export function frameJobProgressEvent<TResult>(event: JobProgressEvent<TResult>): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
