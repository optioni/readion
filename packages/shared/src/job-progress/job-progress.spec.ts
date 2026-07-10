import { describe, expect, it } from 'vitest'
import {
  frameJobProgressEvent,
  isTerminalJobState,
  JOB_PROGRESS_HEARTBEAT,
  type JobProgressEvent,
} from './index'

describe('job-progress contract', () => {
  it('frames a non-terminal event as an unnamed SSE data line', () => {
    const event: JobProgressEvent = { jobId: 'j1', state: 'active' }
    expect(frameJobProgressEvent(event)).toBe(`data: ${JSON.stringify(event)}\n\n`)
  })

  it('carries the result on a terminal frame and round-trips the payload', () => {
    const event: JobProgressEvent<{ fields: { passingScore: number } }> = {
      jobId: 'j1',
      state: 'completed',
      result: { fields: { passingScore: 67 } },
    }
    const framed = frameJobProgressEvent(event)
    expect(framed.startsWith('data: ')).toBe(true)
    expect(framed.endsWith('\n\n')).toBe(true)
    expect(JSON.parse(framed.slice('data: '.length))).toEqual(event)
  })

  it('recognises completed and failed as terminal states', () => {
    expect(isTerminalJobState('completed')).toBe(true)
    expect(isTerminalJobState('failed')).toBe(true)
  })

  it('treats waiting, active, and unknown states as non-terminal', () => {
    expect(isTerminalJobState('waiting')).toBe(false)
    expect(isTerminalJobState('active')).toBe(false)
    expect(isTerminalJobState('unknown')).toBe(false)
  })

  it('exposes an SSE heartbeat comment token', () => {
    expect(JOB_PROGRESS_HEARTBEAT).toContain(': keepalive')
    expect(JOB_PROGRESS_HEARTBEAT.endsWith('\n\n')).toBe(true)
  })
})
