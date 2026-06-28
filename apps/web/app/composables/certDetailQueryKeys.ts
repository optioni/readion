export const certDetailQueryKeys = {
  enrollment: (enrollmentId: string) => ['cert-detail', 'enrollment', enrollmentId] as const,
  certification: (certificationId: string) =>
    ['cert-detail', 'certification', certificationId] as const,
}
