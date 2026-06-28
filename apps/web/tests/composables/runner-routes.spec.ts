import { describe, expect, it } from 'vitest'
import { mockExamRunPath, reviewRunPath, sessionRunPath } from '~/composables/runnerRoutes'

describe('runner route builders', () => {
  it('builds the session run path from a session id', () => {
    expect(sessionRunPath('sess-1')).toBe('/sessions/sess-1')
  })

  it('builds the mock-exam run path from a mock-exam id', () => {
    expect(mockExamRunPath('mock-1')).toBe('/mock-exams/mock-1')
  })

  it('builds the review run path from an enrollment id', () => {
    expect(reviewRunPath('enr-1')).toBe('/user-certifications/enr-1/review')
  })
})
