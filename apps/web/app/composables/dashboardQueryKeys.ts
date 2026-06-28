export const dashboardQueryKeys = {
  enrollments: () => ['dashboard', 'enrollments', 'active'] as const,
  certifications: () => ['dashboard', 'certifications'] as const,
  readiness: (enrollmentId: string) => ['dashboard', 'readiness', enrollmentId] as const,
  weakAreas: (enrollmentId: string) => ['dashboard', 'weak-areas', enrollmentId] as const,
  recentSessions: (enrollmentId: string, certificationId: string) =>
    ['dashboard', 'recent-sessions', enrollmentId, certificationId] as const,
  dueReviews: (enrollmentId: string) => ['dashboard', 'due-reviews', enrollmentId] as const,
}
