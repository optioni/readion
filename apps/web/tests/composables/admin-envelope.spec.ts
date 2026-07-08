import type {
  AdminUserListItem,
  AuditLogEntry,
  ContentSourceResponse,
  DiscoverSourcesResponse,
  DueForReverificationItem,
  ExtractionStatusResponse,
  IngestionJobStatus,
  QuarantinedItemDetail,
} from '@readion/shared'
import { describe, expect, it } from 'vitest'
import {
  readAuditLogsEnvelope,
  readContentSourcesEnvelope,
  readCoverageEnvelope,
  readDataEnvelope,
  readDiscoverSourcesEnvelope,
  readDueForReverificationEnvelope,
  readExtractionStatusEnvelope,
  readListEnvelope,
  readQuarantineDetailEnvelope,
  readSourceJobsEnvelope,
  readUsersEnvelope,
} from '~/composables/adminEnvelope'
import type { CoverageReportDto } from '~~/src/api/model/coverageReportDto'

describe('admin envelope narrowing helpers', () => {
  it('readListEnvelope extracts data and meta from a collection envelope', () => {
    const meta = { total: 3, page: 1, limit: 20 }
    const response = { data: { data: [{ id: 'a' }, { id: 'b' }], meta } }

    const result = readListEnvelope<{ id: string }>(response)

    expect(result.data).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(result.meta).toEqual(meta)
  })

  it('readDataEnvelope extracts the single payload', () => {
    const response = { data: { data: { id: 'a', value: 42 } } }

    expect(readDataEnvelope<{ id: string; value: number }>(response)).toEqual({
      id: 'a',
      value: 42,
    })
  })

  it('readUsersEnvelope narrows to the admin user list', () => {
    const item: AdminUserListItem = {
      id: 'u1',
      email: 'a@b.com',
      role: 'user',
      emailVerified: true,
      createdAt: '2026-01-01',
      enrollmentCount: 2,
    }
    const response = { data: { data: [item], meta: { total: 1, page: 1, limit: 20 } } }

    const result = readUsersEnvelope(response)

    expect(result.data[0]).toEqual(item)
    expect(result.meta.total).toBe(1)
  })

  it('readAuditLogsEnvelope narrows to audit log entries', () => {
    const entry: AuditLogEntry = {
      id: 'l1',
      userId: 'u1',
      actorEmail: 'admin@example.com',
      action: 'user.role.promoted',
      targetType: 'user',
      targetId: 'u2',
      targetLabel: 'target@example.com',
      before: null,
      after: null,
      createdAt: '2026-01-01',
    }
    const response = { data: { data: [entry], meta: { total: 1, page: 1, limit: 20 } } }

    expect(readAuditLogsEnvelope(response).data[0]).toEqual(entry)
  })

  it('readContentSourcesEnvelope narrows to content sources', () => {
    const source: ContentSourceResponse = {
      id: 's1',
      certificationId: 'c1',
      type: 'web',
      url: 'https://example.com',
      enabled: true,
      lastFetchedAt: null,
      recheckIntervalMinutes: 60,
      createdAt: '2026-01-01',
    }
    const response = { data: { data: [source] } }

    expect(readContentSourcesEnvelope(response)[0]).toEqual(source)
  })

  it('readSourceJobsEnvelope narrows to ingestion job statuses', () => {
    const job: IngestionJobStatus = {
      jobId: 'j1',
      state: 'active',
      progress: 50,
      attemptsMade: 1,
      failedReason: null,
      timestamp: 1,
      processedOn: 2,
      finishedOn: null,
    }
    const response = { data: { data: [job] } }

    expect(readSourceJobsEnvelope(response)[0]).toEqual(job)
  })

  it('readDiscoverSourcesEnvelope narrows to discover sources response', () => {
    const payload: DiscoverSourcesResponse = {
      candidates: [{ url: 'https://x.com', title: 'X' }],
    }
    const response = { data: { data: payload } }

    expect(readDiscoverSourcesEnvelope(response)).toEqual(payload)
  })

  it('readExtractionStatusEnvelope narrows to extraction status response', () => {
    const payload: ExtractionStatusResponse = { state: 'completed', fields: null }
    const response = { data: { data: payload } }

    expect(readExtractionStatusEnvelope(response)).toEqual(payload)
  })

  it('readDueForReverificationEnvelope narrows to the due list', () => {
    const item: DueForReverificationItem = {
      id: 'c1',
      name: 'AWS',
      code: 'AWS-SAA',
      verifiedAt: '2026-01-01',
      dueForReverification: true,
    }
    const response = { data: { data: [item] } }

    expect(readDueForReverificationEnvelope(response)[0]).toEqual(item)
  })

  it('readCoverageEnvelope narrows to the real coverage report shape', () => {
    const payload: CoverageReportDto = {
      domains: [
        { name: 'IAM', chunkCount: 25, chunkThreshold: 30, enabledSourceCount: 2, met: false },
      ],
      totalChunks: 25,
      totalThreshold: 30,
      state: 'draft',
      met: false,
    }
    const response = { data: { data: payload } }

    expect(readCoverageEnvelope(response)).toEqual(payload)
  })

  it('readQuarantineDetailEnvelope narrows to a single quarantined item detail', () => {
    const payload: QuarantinedItemDetail = {
      id: 'q1',
      certificationId: 'c1',
      domain: 'Compute',
      verdict: JSON.stringify({ pass: false, score: 0.2 }),
      reason: 'The answer key is incorrect',
      status: 'pending',
      provenance: {
        sourceChunkIds: ['chunk-1'],
        supportingSpans: ['span'],
        verdict: { pass: false, score: 0.2, distractorFindings: [] },
        score: 0.2,
      },
      createdAt: '2026-01-01',
      content: null,
    }
    const response = { data: { data: payload } }

    expect(readQuarantineDetailEnvelope(response)).toEqual(payload)
  })
})
