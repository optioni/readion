import { describe, expect, it } from 'vitest'

describe('web-progress Orval contract', () => {
  it('readinessControllerRead is a function in the committed client', async () => {
    const { readinessControllerRead } = await import('~~/src/api/readiness/readiness')
    expect(typeof readinessControllerRead).toBe('function')
  })

  it('userCertificationsControllerList is a function', async () => {
    const { userCertificationsControllerList } = await import(
      '~~/src/api/user-certifications/user-certifications'
    )
    expect(typeof userCertificationsControllerList).toBe('function')
  })

  it('userCertificationsControllerDetail is a function', async () => {
    const { userCertificationsControllerDetail } = await import(
      '~~/src/api/user-certifications/user-certifications'
    )
    expect(typeof userCertificationsControllerDetail).toBe('function')
  })

  it('userCertificationsControllerListWeakAreas is a function', async () => {
    const { userCertificationsControllerListWeakAreas } = await import(
      '~~/src/api/user-certifications/user-certifications'
    )
    expect(typeof userCertificationsControllerListWeakAreas).toBe('function')
  })

  it('certificationsControllerDetail is a function', async () => {
    const { certificationsControllerDetail } = await import(
      '~~/src/api/certifications/certifications'
    )
    expect(typeof certificationsControllerDetail).toBe('function')
  })

  it('sessionsControllerList is a function', async () => {
    const { sessionsControllerList } = await import('~~/src/api/sessions/sessions')
    expect(typeof sessionsControllerList).toBe('function')
  })

  it('sessionsControllerDetail is a function', async () => {
    const { sessionsControllerDetail } = await import('~~/src/api/sessions/sessions')
    expect(typeof sessionsControllerDetail).toBe('function')
  })

  it('sessionSummaryControllerSummary is a function', async () => {
    const { sessionSummaryControllerSummary } = await import(
      '~~/src/api/session-summary/session-summary'
    )
    expect(typeof sessionSummaryControllerSummary).toBe('function')
  })

  it('sessionSummaryControllerDrill is a function', async () => {
    const { sessionSummaryControllerDrill } = await import(
      '~~/src/api/session-summary/session-summary'
    )
    expect(typeof sessionSummaryControllerDrill).toBe('function')
  })

  it('enrollmentReviewControllerQueue is a function', async () => {
    const { enrollmentReviewControllerQueue } = await import(
      '~~/src/api/enrollment-review/enrollment-review'
    )
    expect(typeof enrollmentReviewControllerQueue).toBe('function')
  })

  it('enrollmentReviewControllerStart is a function', async () => {
    const { enrollmentReviewControllerStart } = await import(
      '~~/src/api/enrollment-review/enrollment-review'
    )
    expect(typeof enrollmentReviewControllerStart).toBe('function')
  })

  it('enrollmentReviewControllerSuppressDomain is a function', async () => {
    const { enrollmentReviewControllerSuppressDomain } = await import(
      '~~/src/api/enrollment-review/enrollment-review'
    )
    expect(typeof enrollmentReviewControllerSuppressDomain).toBe('function')
  })

  it('reviewItemsControllerMaster is a function', async () => {
    const { reviewItemsControllerMaster } = await import('~~/src/api/review-items/review-items')
    expect(typeof reviewItemsControllerMaster).toBe('function')
  })

  it('quizControllerSubmitAnswer is a function', async () => {
    const { quizControllerSubmitAnswer } = await import('~~/src/api/quiz/quiz')
    expect(typeof quizControllerSubmitAnswer).toBe('function')
  })

  it('quizControllerGenerateExplanation is a function', async () => {
    const { quizControllerGenerateExplanation } = await import('~~/src/api/quiz/quiz')
    expect(typeof quizControllerGenerateExplanation).toBe('function')
  })

  it('quizControllerReportQuestion is a function', async () => {
    const { quizControllerReportQuestion } = await import('~~/src/api/quiz/quiz')
    expect(typeof quizControllerReportQuestion).toBe('function')
  })

  it('enrollmentMockExamControllerList is a function', async () => {
    const { enrollmentMockExamControllerList } = await import(
      '~~/src/api/enrollment-mock-exam/enrollment-mock-exam'
    )
    expect(typeof enrollmentMockExamControllerList).toBe('function')
  })
})
