import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { lifecycleEmailApiEnvFragment, lifecycleEmailWorkerEnvFragment } from '../env/lifecycle-email'
import {
  DIGEST_SEND_HOUR_DEFAULT,
  DIGEST_SEND_WEEKDAY_DEFAULT,
  EXAM_READY_THRESHOLD_DEFAULT,
  examOutcomeRequestSchema,
  examOutcomeResponses,
  lifecycleEnrollmentIdsRequestSchema,
  lifecycleUserIdsRequestSchema,
  NUDGE_ACTIVITY_LULL_DAYS_DEFAULT,
  NUDGE_FOLLOWUP_DELAY_DAYS_DEFAULT,
  NUDGE_MAX_FOLLOWUPS_DEFAULT,
} from './index'

describe('exam-outcome response option set', () => {
  it('lists exactly the four allowed responses in order', () => {
    expect(examOutcomeResponses).toEqual(['passed', 'did_not_pass', 'not_yet', 'dismissed'])
  })

  it('accepts each allowed outcome', () => {
    for (const outcome of examOutcomeResponses) {
      expect(examOutcomeRequestSchema.parse({ outcome }).outcome).toBe(outcome)
    }
  })

  it('rejects an unknown outcome', () => {
    expect(() => examOutcomeRequestSchema.parse({ outcome: 'maybe' })).toThrow()
  })
})

describe('lifecycle internal payload schema', () => {
  it('accepts an array of user ids', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    expect(lifecycleUserIdsRequestSchema.parse({ userIds: [id] })).toEqual({ userIds: [id] })
  })

  it('rejects a non-uuid user id', () => {
    expect(() => lifecycleUserIdsRequestSchema.parse({ userIds: ['nope'] })).toThrow()
  })
})

describe('lifecycle enrollment-scoped nudge payload schema', () => {
  it('accepts an array of user-certification ids', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    expect(lifecycleEnrollmentIdsRequestSchema.parse({ userCertificationIds: [id] })).toEqual({
      userCertificationIds: [id],
    })
  })

  it('rejects a non-uuid user-certification id', () => {
    expect(() =>
      lifecycleEnrollmentIdsRequestSchema.parse({ userCertificationIds: ['nope'] }),
    ).toThrow()
  })
})

describe('lifecycle-email config defaults', () => {
  it('defaults EXAM_READY_THRESHOLD to 80', () => {
    expect(EXAM_READY_THRESHOLD_DEFAULT).toBe(80)
  })

  it('defaults NUDGE_MAX_FOLLOWUPS to 1', () => {
    expect(NUDGE_MAX_FOLLOWUPS_DEFAULT).toBe(1)
  })

  it('exposes numeric scheduling defaults', () => {
    expect(DIGEST_SEND_WEEKDAY_DEFAULT).toBeTypeOf('number')
    expect(DIGEST_SEND_HOUR_DEFAULT).toBeTypeOf('number')
    expect(NUDGE_ACTIVITY_LULL_DAYS_DEFAULT).toBeTypeOf('number')
    expect(NUDGE_FOLLOWUP_DELAY_DAYS_DEFAULT).toBeTypeOf('number')
  })
})

describe('lifecycle-email api env fragment', () => {
  const schema = z.object(lifecycleEmailApiEnvFragment)

  const validMinimal = {
    INTERNAL_API_SECRET: 'secret',
    PUBLIC_API_URL: 'http://localhost:3001',
  }

  it('applies defaults for the numeric keys', () => {
    const parsed = schema.parse(validMinimal)
    expect(parsed.DIGEST_SEND_WEEKDAY).toBe(DIGEST_SEND_WEEKDAY_DEFAULT)
    expect(parsed.DIGEST_SEND_HOUR).toBe(DIGEST_SEND_HOUR_DEFAULT)
    expect(parsed.EXAM_READY_THRESHOLD).toBe(EXAM_READY_THRESHOLD_DEFAULT)
    expect(parsed.NUDGE_ACTIVITY_LULL_DAYS).toBe(NUDGE_ACTIVITY_LULL_DAYS_DEFAULT)
    expect(parsed.NUDGE_FOLLOWUP_DELAY_DAYS).toBe(NUDGE_FOLLOWUP_DELAY_DAYS_DEFAULT)
    expect(parsed.NUDGE_MAX_FOLLOWUPS).toBe(NUDGE_MAX_FOLLOWUPS_DEFAULT)
  })

  it('coerces numeric strings to numbers', () => {
    const parsed = schema.parse({
      ...validMinimal,
      DIGEST_SEND_WEEKDAY: '3',
      DIGEST_SEND_HOUR: '8',
      EXAM_READY_THRESHOLD: '75',
      NUDGE_MAX_FOLLOWUPS: '1',
    })
    expect(parsed.DIGEST_SEND_WEEKDAY).toBe(3)
    expect(parsed.DIGEST_SEND_HOUR).toBe(8)
    expect(parsed.EXAM_READY_THRESHOLD).toBe(75)
    expect(parsed.NUDGE_MAX_FOLLOWUPS).toBe(1)
  })

  it('requires a non-empty INTERNAL_API_SECRET', () => {
    expect(() => schema.parse({ ...validMinimal, INTERNAL_API_SECRET: '' })).toThrow()
  })

  it('requires a valid PUBLIC_API_URL', () => {
    expect(() => schema.parse({ ...validMinimal, PUBLIC_API_URL: 'not-a-url' })).toThrow()
  })

  it('rejects an out-of-range weekday', () => {
    expect(() => schema.parse({ ...validMinimal, DIGEST_SEND_WEEKDAY: '7' })).toThrow()
  })

  it('rejects an out-of-range hour', () => {
    expect(() => schema.parse({ ...validMinimal, DIGEST_SEND_HOUR: '24' })).toThrow()
  })

  it('rejects a non-numeric hour', () => {
    expect(() => schema.parse({ ...validMinimal, DIGEST_SEND_HOUR: 'noon' })).toThrow()
  })

  it('rejects a threshold above 100', () => {
    expect(() => schema.parse({ ...validMinimal, EXAM_READY_THRESHOLD: '101' })).toThrow()
  })

  it('rejects a negative follow-up cap', () => {
    expect(() => schema.parse({ ...validMinimal, NUDGE_MAX_FOLLOWUPS: '-1' })).toThrow()
  })

  it('rejects a non-positive lull window', () => {
    expect(() => schema.parse({ ...validMinimal, NUDGE_ACTIVITY_LULL_DAYS: '0' })).toThrow()
  })
})

describe('lifecycle-email worker env fragment', () => {
  const schema = z.object(lifecycleEmailWorkerEnvFragment)

  it('requires a valid INTERNAL_API_BASE_URL and applies scheduling defaults', () => {
    const parsed = schema.parse({
      INTERNAL_API_SECRET: 'secret',
      INTERNAL_API_BASE_URL: 'http://localhost:3001',
    })
    expect(parsed.INTERNAL_API_BASE_URL).toBe('http://localhost:3001')
    expect(parsed.DIGEST_SEND_WEEKDAY).toBe(DIGEST_SEND_WEEKDAY_DEFAULT)
  })

  it('rejects a missing INTERNAL_API_BASE_URL', () => {
    expect(() => schema.parse({ INTERNAL_API_SECRET: 'secret' })).toThrow()
  })
})
