export const adminQueryKeys = {
  users: (page?: number) =>
    page === undefined ? (['admin', 'users'] as const) : (['admin', 'users', page] as const),
  auditLogs: (page?: number) =>
    page === undefined
      ? (['admin', 'audit-logs'] as const)
      : (['admin', 'audit-logs', page] as const),
  quarantine: () => ['admin', 'quarantine'] as const,
  quarantineDetail: (id: string) => ['admin', 'quarantine', id] as const,
  contentSources: (certId: string) => ['admin', 'content-sources', certId] as const,
  sourceJobs: (id: string) => ['admin', 'source-jobs', id] as const,
  dueForReverification: () => ['admin', 'due-for-reverification'] as const,
  coverage: (certId: string) => ['admin', 'coverage', certId] as const,
  certification: (certId: string) => ['admin', 'certification', certId] as const,
  extraction: (jobId: string) => ['admin', 'extraction', jobId] as const,
}
