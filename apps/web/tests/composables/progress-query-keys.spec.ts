import { describe, expect, it } from 'vitest'
import { progressQueryKeys } from '~/composables/progressQueryKeys'

describe('progressQueryKeys', () => {
  it('builds the readiness key from an enrollment id', () => {
    expect(progressQueryKeys.readiness('e-1')).toEqual(['progress', 'readiness', 'e-1'])
  })

  it('builds the weakAreas key from an enrollment id', () => {
    expect(progressQueryKeys.weakAreas('e-1')).toEqual(['progress', 'weak-areas', 'e-1'])
  })

  it('builds the certification key from a certification id', () => {
    expect(progressQueryKeys.certification('c-1')).toEqual(['progress', 'certification', 'c-1'])
  })

  it('builds the enrollments key with no arguments', () => {
    expect(progressQueryKeys.enrollments()).toEqual(['progress', 'enrollments'])
  })

  it('builds the sessions key from certificationId, page, and limit', () => {
    expect(progressQueryKeys.sessions('c-1', 1, 20)).toEqual(['progress', 'sessions', 'c-1', 1, 20])
  })

  it('builds the sessionSummary key from a session id', () => {
    expect(progressQueryKeys.sessionSummary('s-1')).toEqual(['progress', 'session-summary', 's-1'])
  })

  it('builds the mockExams key from an enrollment id', () => {
    expect(progressQueryKeys.mockExams('e-1')).toEqual(['progress', 'mock-exams', 'e-1'])
  })

  it('builds the reviewQueue key from an enrollment id', () => {
    expect(progressQueryKeys.reviewQueue('e-1')).toEqual(['progress', 'review-queue', 'e-1'])
  })
})
