import type { QuarantinedItemDetail } from '@readion/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminQuarantineDetail } from '~/composables/useAdminQuarantineDetail'
import { quarantineAdminControllerDetail } from '~~/src/api/quarantine-admin/quarantine-admin'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/quarantine-admin/quarantine-admin')

const ITEM_ID = 'f0000000-0000-0000-0000-000000000001'

const DETAIL: QuarantinedItemDetail = {
  id: ITEM_ID,
  certificationId: 'c0000000-0000-0000-0000-000000000001',
  domain: 'Storage',
  verdict: JSON.stringify({ pass: false, score: 0.2 }),
  reason: 'The answer key is incorrect',
  status: 'pending',
  provenance: {
    sourceChunkIds: ['chunk-1'],
    supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
    verdict: { pass: false, score: 0.2, distractorFindings: [] },
    score: 0.2,
  },
  createdAt: '2026-06-20T10:00:00.000Z',
  content: {
    question: 'Which AWS service provides scalable object storage?',
    options: ['Amazon EC2', 'Amazon S3', 'Amazon RDS', 'Amazon VPC'],
    answerKey: 'Amazon S3',
    format: 'multiple_choice',
    supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
    sourceChunkIds: ['chunk-1'],
  },
}

const detailEnvelope = { data: { data: DETAIL }, status: 200, headers: new Headers() }

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAdminQuarantineDetail', () => {
  it('fetches and narrows the detail envelope for the given id', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(quarantineAdminControllerDetail).mockResolvedValue(detailEnvelope as any)

    const { result, queryClient } = renderComposable(() => useAdminQuarantineDetail(ref(ITEM_ID)))

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(DETAIL)
    })
    expect(quarantineAdminControllerDetail).toHaveBeenCalledWith(ITEM_ID)
    expect(queryClient.getQueryData(adminQueryKeys.quarantineDetail(ITEM_ID))).toEqual(DETAIL)
  })

  it('does not fetch when the id is null', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(quarantineAdminControllerDetail).mockResolvedValue(detailEnvelope as any)

    renderComposable(() => useAdminQuarantineDetail(ref(null)))

    await Promise.resolve()
    expect(quarantineAdminControllerDetail).not.toHaveBeenCalled()
  })
})
