import type { AdminUserListItem, CollectionMeta } from '@readion/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminUsers } from '~/composables/useAdminUsers'
import { adminControllerListUsers } from '~~/src/api/admin/admin'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/admin/admin')

const USERS: AdminUserListItem[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'root@readion.io',
    role: 'admin',
    emailVerified: true,
    createdAt: '2026-01-15T10:00:00.000Z',
    enrollmentCount: 0,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'casey@org.io',
    role: 'user',
    emailVerified: true,
    createdAt: '2026-02-20T10:00:00.000Z',
    enrollmentCount: 3,
  },
]

const META: CollectionMeta = { total: 2, page: 1, limit: 20 }

const listEnvelope = {
  data: { data: USERS, meta: META },
  status: 200,
  headers: new Headers(),
}

describe('useAdminUsers', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reads and narrows the users envelope from adminControllerListUsers', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(adminControllerListUsers).mockResolvedValue(listEnvelope as any)

    const { result } = renderComposable(() => useAdminUsers())

    await vi.waitFor(() => {
      expect(result.data.value).toEqual({ data: USERS, meta: META })
    })
    expect(adminControllerListUsers).toHaveBeenCalledOnce()
  })

  it('caches the users under the shared admin users key', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(adminControllerListUsers).mockResolvedValue(listEnvelope as any)

    const { result, queryClient } = renderComposable(() => useAdminUsers())

    await vi.waitFor(() => {
      expect(result.data.value).toBeDefined()
    })
    expect(queryClient.getQueryData(adminQueryKeys.users())).toEqual({ data: USERS, meta: META })
  })
})
