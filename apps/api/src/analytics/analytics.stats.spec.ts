import { describe, expect, it } from 'vitest'
import {
  agentEngagementFraction,
  completionRate,
  isActiveUser,
  isWithinWindow,
  median,
  medianSessionsPerWeek,
  selectActiveUsers,
  sessionsPerWeek,
} from './analytics.stats'

describe('median', () => {
  it('returns the middle value for an odd-length set', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the two middle values for an even-length set', () => {
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })

  it('returns the single value', () => {
    expect(median([5])).toBe(5)
  })

  it('returns 0 for an empty set', () => {
    expect(median([])).toBe(0)
  })
})

describe('completionRate', () => {
  it('divides reached-summary by started', () => {
    expect(completionRate({ reachedSummary: 3, started: 4 })).toBe(0.75)
  })

  it('handles a non-trivial ratio', () => {
    expect(completionRate({ reachedSummary: 7, started: 9 })).toBeCloseTo(7 / 9)
  })

  it('returns 0 when nothing was started', () => {
    expect(completionRate({ reachedSummary: 0, started: 0 })).toBe(0)
  })
})

describe('agentEngagementFraction', () => {
  it('is the fraction of sessions carrying an agent interaction', () => {
    expect(agentEngagementFraction({ sessionsWithAgent: 3, totalSessions: 9 })).toBeCloseTo(1 / 3)
  })

  it('returns 0 with no sessions', () => {
    expect(agentEngagementFraction({ sessionsWithAgent: 0, totalSessions: 0 })).toBe(0)
  })
})

describe('sessionsPerWeek', () => {
  it('normalizes completed sessions over the window into a weekly rate', () => {
    expect(sessionsPerWeek(2, 14)).toBe(1)
  })

  it('scales for a one-week window', () => {
    expect(sessionsPerWeek(3, 7)).toBe(3)
  })

  it('returns 0 with no completed sessions', () => {
    expect(sessionsPerWeek(0, 14)).toBe(0)
  })
})

describe('isWithinWindow', () => {
  const now = new Date('2026-06-28T00:00:00.000Z')
  const windowDays = 14
  const windowStartMs = now.getTime() - windowDays * 86_400_000

  it('includes a timestamp exactly at the window start (inclusive lower bound)', () => {
    expect(isWithinWindow(new Date(windowStartMs), now, windowDays)).toBe(true)
  })

  it('excludes a timestamp one millisecond before the window start', () => {
    expect(isWithinWindow(new Date(windowStartMs - 1), now, windowDays)).toBe(false)
  })

  it('includes the reporting instant (inclusive upper bound)', () => {
    expect(isWithinWindow(now, now, windowDays)).toBe(true)
  })

  it('excludes a future timestamp', () => {
    expect(isWithinWindow(new Date(now.getTime() + 1), now, windowDays)).toBe(false)
  })
})

describe('isActiveUser', () => {
  const now = new Date('2026-06-28T00:00:00.000Z')
  const windowDays = 14
  const minSessions = 2
  const windowStart = new Date(now.getTime() - windowDays * 86_400_000)
  const within = new Date(now.getTime() - 86_400_000)
  const opts = { now, windowDays, minSessions }

  it('is active with enough completed sessions ended within the window', () => {
    expect(
      isActiveUser({
        sessions: [
          { status: 'completed', endedAt: within },
          { status: 'partial', endedAt: within },
        ],
        ...opts,
      }),
    ).toBe(true)
  })

  it('counts a session ended exactly at the window start (boundary inclusive)', () => {
    expect(
      isActiveUser({
        sessions: [
          { status: 'completed', endedAt: windowStart },
          { status: 'completed', endedAt: within },
        ],
        ...opts,
      }),
    ).toBe(true)
  })

  it('is inactive when a qualifying session falls one millisecond before the window start', () => {
    expect(
      isActiveUser({
        sessions: [
          { status: 'completed', endedAt: new Date(windowStart.getTime() - 1) },
          { status: 'completed', endedAt: within },
        ],
        ...opts,
      }),
    ).toBe(false)
  })

  it('excludes abandoned sessions from the count', () => {
    expect(
      isActiveUser({
        sessions: [
          { status: 'completed', endedAt: within },
          { status: 'abandoned', endedAt: within },
        ],
        ...opts,
      }),
    ).toBe(false)
  })

  it('excludes in-progress (active) sessions from the count', () => {
    expect(
      isActiveUser({
        sessions: [
          { status: 'completed', endedAt: within },
          { status: 'active', endedAt: null },
        ],
        ...opts,
      }),
    ).toBe(false)
  })
})

describe('selectActiveUsers', () => {
  const now = new Date('2026-06-28T00:00:00.000Z')
  const windowDays = 14
  const minSessions = 2
  const within = new Date(now.getTime() - 86_400_000)
  const outside = new Date(now.getTime() - 20 * 86_400_000)

  it('returns the qualifying users with their in-window completed counts', () => {
    const result = selectActiveUsers(
      [
        {
          userId: 'u1',
          sessions: [
            { status: 'completed', endedAt: within },
            { status: 'partial', endedAt: within },
          ],
        },
        {
          userId: 'u2',
          sessions: [
            { status: 'completed', endedAt: within },
            { status: 'completed', endedAt: outside },
          ],
        },
        {
          userId: 'u3',
          sessions: [
            { status: 'abandoned', endedAt: within },
            { status: 'completed', endedAt: within },
          ],
        },
      ],
      { now, windowDays, minSessions },
    )

    expect(result.userIds).toEqual(['u1'])
    expect(result.completedByUser.get('u1')).toBe(2)
  })
})

describe('medianSessionsPerWeek', () => {
  it('takes the median weekly rate across the active users', () => {
    const completedByUser = new Map([
      ['u1', 2],
      ['u2', 4],
    ])
    expect(medianSessionsPerWeek(completedByUser, ['u1', 'u2'], 14)).toBe(1.5)
  })

  it('returns 0 when there are no active users', () => {
    expect(medianSessionsPerWeek(new Map(), [], 14)).toBe(0)
  })
})
