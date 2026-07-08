import type { AuditLogEntry, CollectionMeta } from '@readion/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminAuditLogs } from '~/composables/useAdminAuditLogs'
import { adminControllerListAuditLogs } from '~~/src/api/admin/admin'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/admin/admin')

const ENTRIES = [
  {
    id: 'audit-1',
    userId: '00000000-0000-0000-0000-000000000001',
    action: 'user.promote',
    targetType: 'user',
    targetId: '00000000-0000-0000-0000-000000000002',
    before: { role: 'user' },
    after: { role: 'admin' },
    createdAt: '2026-06-20T10:00:00.000Z',
  },
  {
    id: 'audit-2',
    userId: null,
    action: 'content-source.reingest',
    targetType: 'content-source',
    targetId: '00000000-0000-0000-0000-000000000003',
    before: null,
    after: null,
    createdAt: '2026-06-21T12:30:00.000Z',
  },
] as unknown as AuditLogEntry[]

const META: CollectionMeta = { total: 2, page: 1, limit: 20 }

const listEnvelope = {
  data: { data: ENTRIES, meta: META },
  status: 200,
  headers: new Headers(),
}

describe('useAdminAuditLogs', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reads and narrows the audit-logs envelope from adminControllerListAuditLogs', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(adminControllerListAuditLogs).mockResolvedValue(listEnvelope as any)

    const { result } = renderComposable(() => useAdminAuditLogs())

    await vi.waitFor(() => {
      expect(result.data.value).toEqual({ data: ENTRIES, meta: META })
    })
    expect(adminControllerListAuditLogs).toHaveBeenCalledOnce()
    expect(adminControllerListAuditLogs).toHaveBeenCalledWith({ page: 1, limit: 20 })
  })

  it('caches the entries under the shared admin audit-logs key', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(adminControllerListAuditLogs).mockResolvedValue(listEnvelope as any)

    const { result, queryClient } = renderComposable(() => useAdminAuditLogs())

    await vi.waitFor(() => {
      expect(result.data.value).toBeDefined()
    })
    expect(queryClient.getQueryData(adminQueryKeys.auditLogs(1))).toEqual({
      data: ENTRIES,
      meta: META,
    })
  })

  it('passes the reactive page to the generated client and refetches when it changes', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(adminControllerListAuditLogs).mockResolvedValue(listEnvelope as any)
    const page = ref(1)

    const { result, queryClient } = renderComposable(() => useAdminAuditLogs(page))

    await vi.waitFor(() => {
      expect(result.data.value).toBeDefined()
    })
    expect(adminControllerListAuditLogs).toHaveBeenCalledWith({ page: 1, limit: 20 })

    page.value = 2
    await vi.waitFor(() => {
      expect(adminControllerListAuditLogs).toHaveBeenCalledWith({ page: 2, limit: 20 })
    })
    expect(queryClient.getQueryData(adminQueryKeys.auditLogs(2))).toEqual({
      data: ENTRIES,
      meta: META,
    })
  })
})
