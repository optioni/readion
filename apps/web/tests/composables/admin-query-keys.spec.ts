import { describe, expect, it } from 'vitest'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'

describe('admin query keys', () => {
  it('builds the users key', () => {
    expect(adminQueryKeys.users()).toEqual(['admin', 'users'])
  })

  it('builds the audit logs key', () => {
    expect(adminQueryKeys.auditLogs()).toEqual(['admin', 'audit-logs'])
  })

  it('builds the content sources key from a certification id', () => {
    expect(adminQueryKeys.contentSources('cert-1')).toEqual(['admin', 'content-sources', 'cert-1'])
  })

  it('builds the source jobs key from a source id', () => {
    expect(adminQueryKeys.sourceJobs('src-1')).toEqual(['admin', 'source-jobs', 'src-1'])
  })

  it('builds the due-for-reverification key', () => {
    expect(adminQueryKeys.dueForReverification()).toEqual(['admin', 'due-for-reverification'])
  })

  it('builds the coverage key from a certification id', () => {
    expect(adminQueryKeys.coverage('cert-1')).toEqual(['admin', 'coverage', 'cert-1'])
  })

  it('builds the certification key from a certification id', () => {
    expect(adminQueryKeys.certification('cert-1')).toEqual(['admin', 'certification', 'cert-1'])
  })

  it('builds the extraction key from a job id', () => {
    expect(adminQueryKeys.extraction('job-1')).toEqual(['admin', 'extraction', 'job-1'])
  })

  it('builds the quarantine detail key from an item id', () => {
    expect(adminQueryKeys.quarantineDetail('item-1')).toEqual(['admin', 'quarantine', 'item-1'])
  })

  it('namespaces every key under "admin"', () => {
    expect(adminQueryKeys.users()[0]).toBe('admin')
    expect(adminQueryKeys.auditLogs()[0]).toBe('admin')
    expect(adminQueryKeys.contentSources('c')[0]).toBe('admin')
    expect(adminQueryKeys.sourceJobs('s')[0]).toBe('admin')
    expect(adminQueryKeys.dueForReverification()[0]).toBe('admin')
    expect(adminQueryKeys.coverage('c')[0]).toBe('admin')
    expect(adminQueryKeys.certification('c')[0]).toBe('admin')
    expect(adminQueryKeys.extraction('j')[0]).toBe('admin')
    expect(adminQueryKeys.quarantineDetail('q')[0]).toBe('admin')
  })

  it('namespaces keys disjointly from dashboardQueryKeys', () => {
    expect(adminQueryKeys.users()[0]).not.toBe(dashboardQueryKeys.certifications()[0])
  })
})
