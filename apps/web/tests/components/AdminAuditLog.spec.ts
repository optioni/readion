import type { AuditLogEntry, CollectionMeta } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import AdminAuditLog from '~/components/admin/AdminAuditLog.vue'
import { useAdminAuditLogs } from '~/composables/useAdminAuditLogs'

vi.mock('~/composables/useAdminAuditLogs', () => ({ useAdminAuditLogs: vi.fn() }))

const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001'
const TARGET_USER_ID = '00000000-0000-0000-0000-000000000002'
const TARGET_SOURCE_ID = '00000000-0000-0000-0000-000000000003'

const ENTRIES = [
  {
    id: 'audit-1',
    userId: ADMIN_USER_ID,
    action: 'user.promote',
    targetType: 'user',
    targetId: TARGET_USER_ID,
    before: { role: 'user' },
    after: { role: 'admin' },
    createdAt: '2026-06-20T10:00:00.000Z',
  },
  {
    id: 'audit-2',
    userId: null,
    action: 'content-source.reingest',
    targetType: 'content-source',
    targetId: TARGET_SOURCE_ID,
    before: null,
    after: null,
    createdAt: '2026-06-21T12:30:00.000Z',
  },
] as unknown as AuditLogEntry[]

const META: CollectionMeta = { total: 2, page: 1, limit: 20 }

function stubAuditLogs(
  entries: AuditLogEntry[] = ENTRIES,
  options: { isLoading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useAdminAuditLogs).mockReturnValue({
    data: computed(() => ({ data: entries, meta: META })),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    refetch: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
}

function mountAuditLog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return mount(AdminAuditLog, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}

function rowFor(wrapper: ReturnType<typeof mountAuditLog>, id: string) {
  return wrapper.find(`[data-testid="audit-log-row"][data-audit-id="${id}"]`)
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdminAuditLog table render', () => {
  it('renders the page root and a row per audit entry', () => {
    stubAuditLogs()
    const wrapper = mountAuditLog()

    expect(wrapper.find('[data-testid="admin-audit-log-page"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="audit-log-row"]')).toHaveLength(2)
  })

  it('renders action, target, before/after snapshot, timestamp and the userId actor', () => {
    stubAuditLogs()
    const wrapper = mountAuditLog()

    const row = rowFor(wrapper, 'audit-1')
    expect(row.find('[data-testid="audit-action"]').text()).toContain('user.promote')
    expect(row.find('[data-testid="audit-target"]').text()).toContain('user')
    expect(row.find('[data-testid="audit-target"]').text()).toContain(TARGET_USER_ID)
    expect(row.find('[data-testid="audit-before"]').text()).toContain('user')
    expect(row.find('[data-testid="audit-after"]').text()).toContain('admin')
    expect(row.find('[data-testid="audit-timestamp"]').text().length).toBeGreaterThan(0)
    expect(row.find('[data-testid="audit-actor"]').text()).toContain(ADMIN_USER_ID)
  })

  it('tolerates a null actor and null before/after without crashing or fabricating an email', () => {
    stubAuditLogs()
    const wrapper = mountAuditLog()

    const row = rowFor(wrapper, 'audit-2')
    expect(row.exists()).toBe(true)
    const actor = row.find('[data-testid="audit-actor"]')
    expect(actor.exists()).toBe(true)
    expect(actor.text()).not.toContain('@')
    expect(row.find('[data-testid="audit-before"]').exists()).toBe(true)
    expect(row.find('[data-testid="audit-after"]').exists()).toBe(true)
  })

  it('exposes no edit, delete or CSV export controls', () => {
    stubAuditLogs()
    const wrapper = mountAuditLog()

    expect(wrapper.find('[data-testid="audit-export-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="audit-edit-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="audit-delete-btn"]').exists()).toBe(false)
  })

  it('shows a loading state and no rows while the query is loading', () => {
    stubAuditLogs([], { isLoading: true })
    const wrapper = mountAuditLog()

    expect(wrapper.find('[data-testid="admin-audit-log-loading"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="audit-log-row"]')).toHaveLength(0)
  })

  it('shows an error state when the query fails', () => {
    stubAuditLogs([], { isError: true })
    const wrapper = mountAuditLog()

    expect(wrapper.find('[data-testid="admin-audit-log-error"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="audit-log-row"]')).toHaveLength(0)
  })
})
