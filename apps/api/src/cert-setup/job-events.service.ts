import { Injectable } from '@nestjs/common'
import {
  frameJobProgressEvent,
  isTerminalJobState,
  JOB_PROGRESS_HEARTBEAT,
  type JobProgressEvent,
} from '@readion/shared'
import { type Queue, QueueEvents } from 'bullmq'

// The response surface a job-events stream needs — a subset of the Express/Node response satisfied by
// both the real controller response and the test recorder.
export type SseStreamResponse = {
  setHeader(name: string, value: string): void
  flushHeaders?(): void
  write(chunk: string): void
  end(): void
  on(event: 'close', listener: () => void): void
}

export interface JobEventsStreamOptions {
  heartbeatMs?: number
  maxDurationMs?: number
}

// Defaults chosen to sit inside the agent SSE / ingress idle windows. Injectable per call so tests can
// drive short values without new env vars.
const DEFAULT_HEARTBEAT_MS = 15_000
const DEFAULT_MAX_DURATION_MS = 5 * 60_000

// Streams a BullMQ job's progress and terminal result over SSE per the job-progress-events contract.
// Reusable across queues; delivered first for cert extraction. Mirrors AgentService.waitForMaterialJob:
// a per-connection QueueEvents subscription reconciled against the job's current state on connect.
@Injectable()
export class JobEventsService {
  async stream(
    queue: Queue,
    jobId: string,
    res: SseStreamResponse,
    options: JobEventsStreamOptions = {},
  ): Promise<void> {
    const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS
    const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const queueEvents = new QueueEvents(queue.name, { connection: queue.opts.connection })
    await queueEvents.waitUntilReady()

    let closed = false
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let maxTimer: ReturnType<typeof setTimeout> | undefined
    let resolveDone: () => void = () => {}
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve
    })

    const finish = async () => {
      if (closed) return
      closed = true
      if (heartbeat) clearInterval(heartbeat)
      if (maxTimer) clearTimeout(maxTimer)
      await queueEvents.close()
      res.end()
      resolveDone()
    }

    // Writes the job's current state as one SSE frame; returns whether that state is terminal. On a
    // terminal state the job's return value is attached as `result` (e.g. the grounded `{ fields }`).
    const writeState = async (): Promise<boolean> => {
      const job = await queue.getJob(jobId)
      if (job === undefined) {
        if (!closed) res.write(frameJobProgressEvent({ jobId, state: 'failed' }))
        return true
      }
      const state = await job.getState()
      const terminal = isTerminalJobState(state)
      const event: JobProgressEvent = { jobId, state }
      if (terminal && job.returnvalue != null) {
        event.result = job.returnvalue
      }
      if (!closed) res.write(frameJobProgressEvent(event))
      return terminal
    }

    const onTerminal = (id: string) => {
      if (id !== jobId || closed) return
      void writeState().then(finish)
    }
    queueEvents.on('completed', ({ jobId: id }) => onTerminal(id))
    queueEvents.on('failed', ({ jobId: id }) => onTerminal(id))
    res.on('close', () => {
      void finish()
    })

    // Emit current state on connect so a job that finished before we subscribed is still reported.
    const terminalOnConnect = await writeState()
    if (terminalOnConnect) {
      await finish()
      return
    }
    if (closed) return

    heartbeat = setInterval(() => {
      if (!closed) res.write(JOB_PROGRESS_HEARTBEAT)
    }, heartbeatMs)
    maxTimer = setTimeout(() => {
      void finish()
    }, maxDurationMs)

    await done
  }
}
