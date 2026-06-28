export const certDetailQueryKeys = {
  enrollment: (enrollmentId: string) => ['cert-detail', 'enrollment', enrollmentId] as const,
  certification: (certificationId: string) =>
    ['cert-detail', 'certification', certificationId] as const,
  weakAreas: (enrollmentId: string) => ['cert-detail', 'weak-areas', enrollmentId] as const,
  overviewSessions: (certificationId: string) =>
    ['cert-detail', 'overview-sessions', certificationId] as const,
  sessions: (certificationId: string, page: number, limit: number) =>
    ['cert-detail', 'sessions', certificationId, page, limit] as const,
  sessionSummary: (sessionId: string) => ['cert-detail', 'session-summary', sessionId] as const,
  mockExams: (enrollmentId: string) => ['cert-detail', 'mock-exams', enrollmentId] as const,
}
