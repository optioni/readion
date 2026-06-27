import type { ExamOutcomeResponse } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { type NudgePolicyInput, shouldSendNudge } from './nudge-policy'

const NOW = new Date('2026-06-29T12:00:00Z')
const MS_PER_DAY = 24 * 60 * 60 * 1000

function input(overrides: Partial<NudgePolicyInput> = {}): NudgePolicyInput {
  return {
    now: NOW,
    examOutcomeResponse: null,
    nudgeCount: 0,
    nudgeSentAt: null,
    maxFollowups: 1,
    followupDelayDays: 3,
    ...overrides,
  }
}

describe('shouldSendNudge', () => {
  it('permits the first nudge when none has been sent', () => {
    expect(shouldSendNudge(input({ nudgeCount: 0 }))).toBe(true)
  })

  it('permits a follow-up once the delay has elapsed', () => {
    expect(
      shouldSendNudge(
        input({
          nudgeCount: 1,
          nudgeSentAt: new Date(NOW.getTime() - 4 * MS_PER_DAY),
        }),
      ),
    ).toBe(true)
  })

  it('blocks a follow-up before the delay has elapsed', () => {
    expect(
      shouldSendNudge(
        input({
          nudgeCount: 1,
          nudgeSentAt: new Date(NOW.getTime() - 2 * MS_PER_DAY),
        }),
      ),
    ).toBe(false)
  })

  it('blocks a follow-up exactly one ms before the delay boundary', () => {
    expect(
      shouldSendNudge(
        input({
          nudgeCount: 1,
          nudgeSentAt: new Date(NOW.getTime() - 3 * MS_PER_DAY + 1),
        }),
      ),
    ).toBe(false)
  })

  it('permits a follow-up exactly at the delay boundary', () => {
    expect(
      shouldSendNudge(
        input({
          nudgeCount: 1,
          nudgeSentAt: new Date(NOW.getTime() - 3 * MS_PER_DAY),
        }),
      ),
    ).toBe(true)
  })

  it('blocks once the first nudge plus the maximum follow-ups have been sent', () => {
    expect(
      shouldSendNudge(
        input({
          nudgeCount: 2,
          nudgeSentAt: new Date(NOW.getTime() - 30 * MS_PER_DAY),
        }),
      ),
    ).toBe(false)
  })

  it('blocks when any response has been recorded, including a dismissal', () => {
    for (const response of ['passed', 'did_not_pass', 'not_yet', 'dismissed'] as const) {
      expect(shouldSendNudge(input({ examOutcomeResponse: response as ExamOutcomeResponse }))).toBe(
        false,
      )
    }
  })

  it('blocks a follow-up with a missing prior send timestamp', () => {
    expect(shouldSendNudge(input({ nudgeCount: 1, nudgeSentAt: null }))).toBe(false)
  })
})
