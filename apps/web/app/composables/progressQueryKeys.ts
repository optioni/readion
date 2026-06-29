export const progressQueryKeys = {
  readiness: (enrollmentId: string) => ['progress', 'readiness', enrollmentId] as const,
  weakAreas: (enrollmentId: string) => ['progress', 'weak-areas', enrollmentId] as const,
  certification: (certificationId: string) =>
    ['progress', 'certification', certificationId] as const,
  enrollments: () => ['progress', 'enrollments'] as const,
  sessions: (certificationId: string, page: number, limit: number) =>
    ['progress', 'sessions', certificationId, page, limit] as const,
  sessionSummary: (sessionId: string) => ['progress', 'session-summary', sessionId] as const,
  mockExams: (enrollmentId: string) => ['progress', 'mock-exams', enrollmentId] as const,
  reviewQueue: (enrollmentId: string) => ['progress', 'review-queue', enrollmentId] as const,
}
