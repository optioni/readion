import { describe, expect, it } from 'vitest'
import {
  agentEngagementFraction,
  type CohortUser,
  cohortRetention,
  completionRate,
  enrollmentGain,
  isActiveUser,
  isWithinWindow,
  median,
  medianReadinessGain,
  medianSessionsPerWeek,
  registrationWeekStart,
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

describe('enrollmentGain', () => {
  it('is now minus at-window-start when calibrated at both ends', () => {
    expect(
      enrollmentGain({ scoreNow: 70, scoreAtT: 45, calibratedNow: true, calibratedAtT: true }),
    ).toBe(25)
  })

  it('returns a negative gain when readiness regressed', () => {
    expect(
      enrollmentGain({ scoreNow: 40, scoreAtT: 55, calibratedNow: true, calibratedAtT: true }),
    ).toBe(-15)
  })

  it('is excluded (null), not zero, when uncalibrated at the window start', () => {
    expect(
      enrollmentGain({ scoreNow: 70, scoreAtT: null, calibratedNow: true, calibratedAtT: false }),
    ).toBeNull()
  })

  it('is excluded (null) when uncalibrated now', () => {
    expect(
      enrollmentGain({ scoreNow: null, scoreAtT: 45, calibratedNow: false, calibratedAtT: true }),
    ).toBeNull()
  })
})

describe('medianReadinessGain', () => {
  it('takes the median per-user gain over the active population', () => {
    expect(
      medianReadinessGain([
        { userId: 'u1', enrollments: [single(50, 45)] },
        { userId: 'u2', enrollments: [single(60, 45)] },
        { userId: 'u3', enrollments: [single(70, 45)] },
      ]),
    ).toBe(15)
  })

  it('excludes an enrollment uncalibrated at the window start rather than counting it as zero', () => {
    // Without exclusion the median of [25, 0, 5] would be 5; excluding u2 yields a median of [25, 5] = 15.
    expect(
      medianReadinessGain([
        { userId: 'u1', enrollments: [single(70, 45)] },
        { userId: 'u2', enrollments: [excludedAtT(60)] },
        { userId: 'u3', enrollments: [single(55, 50)] },
      ]),
    ).toBe(15)
  })

  it('averages a user with multiple calibrated enrollments into one per-user gain', () => {
    expect(
      medianReadinessGain([{ userId: 'u1', enrollments: [single(70, 50), single(40, 30)] }]),
    ).toBe(15)
  })

  it('drops a user whose every enrollment is excluded', () => {
    expect(
      medianReadinessGain([
        { userId: 'u1', enrollments: [single(70, 45)] },
        { userId: 'u2', enrollments: [excludedAtT(60), excludedAtT(80)] },
      ]),
    ).toBe(25)
  })

  it('returns 0 when no user contributes a gain', () => {
    expect(medianReadinessGain([{ userId: 'u1', enrollments: [excludedAtT(60)] }])).toBe(0)
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

describe('registrationWeekStart', () => {
  it('floors a Monday timestamp to that same Monday 00:00 UTC', () => {
    expect(registrationWeekStart(new Date('2026-06-01T00:00:00.000Z')).toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    )
  })

  it('floors a midweek timestamp back to the week-opening Monday', () => {
    expect(registrationWeekStart(new Date('2026-06-04T13:45:00.000Z')).toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    )
  })

  it('keeps the last instant before the next Monday in the opening week', () => {
    expect(registrationWeekStart(new Date('2026-06-07T23:59:59.999Z')).toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    )
  })

  it('rolls a Sunday into the previous Monday, not the next', () => {
    expect(registrationWeekStart(new Date('2026-05-31T12:00:00.000Z')).toISOString()).toBe(
      '2026-05-25T00:00:00.000Z',
    )
  })

  it('opens a new bucket exactly at the next Monday 00:00 UTC', () => {
    expect(registrationWeekStart(new Date('2026-06-08T00:00:00.000Z')).toISOString()).toBe(
      '2026-06-08T00:00:00.000Z',
    )
  })
})

describe('cohortRetention', () => {
  const options = { now: new Date('2026-06-29T00:00:00.000Z'), windowDays: 14, minSessions: 2 }

  // Registration-week cohorts (Monday-anchored UTC weeks) with a known active subset in week 2
  // (boundary = registration + 14d) and week 4 (boundary = registration + 28d). Active means
  // >= minSessions completed sessions ended in the trailing window ending at that boundary.
  const completedAt = (iso: string) => ({ status: 'completed' as const, endedAt: new Date(iso) })

  const cohortA: CohortUser[] = [
    {
      userId: 'a1',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      sessions: ['2026-06-10', '2026-06-14', '2026-06-20', '2026-06-28'].map((d) =>
        completedAt(`${d}T00:00:00.000Z`),
      ),
    },
    {
      userId: 'a2',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      sessions: ['2026-06-10', '2026-06-14', '2026-06-20', '2026-06-28'].map((d) =>
        completedAt(`${d}T00:00:00.000Z`),
      ),
    },
    {
      userId: 'a3',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      sessions: ['2026-06-10', '2026-06-14'].map((d) => completedAt(`${d}T00:00:00.000Z`)),
    },
    {
      userId: 'a4',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      sessions: [completedAt('2026-06-10T00:00:00.000Z')],
    },
  ]

  const cohortB: CohortUser[] = [
    {
      userId: 'b1',
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
      sessions: ['2026-05-10', '2026-05-16', '2026-05-25', '2026-05-30'].map((d) =>
        completedAt(`${d}T00:00:00.000Z`),
      ),
    },
    {
      userId: 'b2',
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
      sessions: [completedAt('2026-05-10T00:00:00.000Z')],
    },
  ]

  // W2 boundary (06-22) has elapsed, W4 boundary (07-06) has not — so this cohort reports W2 only.
  const cohortC: CohortUser[] = [
    {
      userId: 'c1',
      createdAt: new Date('2026-06-08T00:00:00.000Z'),
      sessions: ['2026-06-15', '2026-06-20'].map((d) => completedAt(`${d}T00:00:00.000Z`)),
    },
  ]

  // Registered too recently: even the W2 boundary (07-06) has not elapsed, so it is omitted.
  const cohortD: CohortUser[] = [
    {
      userId: 'd1',
      createdAt: new Date('2026-06-22T00:00:00.000Z'),
      sessions: ['2026-06-25', '2026-06-27'].map((d) => completedAt(`${d}T00:00:00.000Z`)),
    },
  ]

  const allUsers = [...cohortA, ...cohortB, ...cohortC, ...cohortD]

  it('reports per-cohort W2 retention with cohort size, ascending by week', () => {
    const { w2 } = cohortRetention(allUsers, options)
    expect(w2.cohorts).toEqual([
      { cohortWeek: '2026-05-04', size: 2, retained: 1, fraction: 0.5 },
      { cohortWeek: '2026-06-01', size: 4, retained: 3, fraction: 0.75 },
      { cohortWeek: '2026-06-08', size: 1, retained: 1, fraction: 1 },
    ])
  })

  it('reports per-cohort W4 retention only for cohorts whose W4 boundary has elapsed', () => {
    const { w4 } = cohortRetention(allUsers, options)
    expect(w4.cohorts).toEqual([
      { cohortWeek: '2026-05-04', size: 2, retained: 1, fraction: 0.5 },
      { cohortWeek: '2026-06-01', size: 4, retained: 2, fraction: 0.5 },
    ])
  })

  it('pools the overall W2 fraction and population across mature cohorts', () => {
    const { w2 } = cohortRetention(allUsers, options)
    expect(w2.population).toBe(7)
    expect(w2.value).toBeCloseTo(5 / 7)
  })

  it('pools the overall W4 fraction and population across W4-mature cohorts only', () => {
    const { w4 } = cohortRetention(allUsers, options)
    expect(w4.population).toBe(6)
    expect(w4.value).toBeCloseTo(0.5)
  })

  it('omits an entirely immature cohort and reports zeroed overalls when nothing is mature', () => {
    const result = cohortRetention(cohortD, options)
    expect(result.w2.cohorts).toEqual([])
    expect(result.w4.cohorts).toEqual([])
    expect(result.w2).toEqual({ value: 0, population: 0, cohorts: [] })
    expect(result.w4).toEqual({ value: 0, population: 0, cohorts: [] })
  })
})

function single(scoreNow: number, scoreAtT: number) {
  return { scoreNow, scoreAtT, calibratedNow: true, calibratedAtT: true } as const
}

function excludedAtT(scoreNow: number) {
  return { scoreNow, scoreAtT: null, calibratedNow: true, calibratedAtT: false } as const
}
