export const certDetailQueryKeys = {
  enrollment: (enrollmentId: string) => ['cert-detail', 'enrollment', enrollmentId] as const,
  certification: (certificationId: string) =>
    ['cert-detail', 'certification', certificationId] as const,
  weakAreas: (enrollmentId: string) => ['cert-detail', 'weak-areas', enrollmentId] as const,
  overviewSessions: (certificationId: string) =>
    ['cert-detail', 'overview-sessions', certificationId] as const,
}
