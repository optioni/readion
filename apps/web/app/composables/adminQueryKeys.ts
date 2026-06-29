export const adminQueryKeys = {
  users: () => ['admin', 'users'] as const,
  auditLogs: () => ['admin', 'audit-logs'] as const,
  contentSources: (certId: string) => ['admin', 'content-sources', certId] as const,
  sourceJobs: (id: string) => ['admin', 'source-jobs', id] as const,
  dueForReverification: () => ['admin', 'due-for-reverification'] as const,
  coverage: (certId: string) => ['admin', 'coverage', certId] as const,
  certification: (certId: string) => ['admin', 'certification', certId] as const,
  extraction: (jobId: string) => ['admin', 'extraction', jobId] as const,
}
