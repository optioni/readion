import type { AdminUserListItem, CollectionMeta } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, toValue } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminUsers from '~/components/admin/AdminUsers.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminUsers } from '~/composables/useAdminUsers'
import { adminControllerDemote, adminControllerPromote } from '~~/src/api/admin/admin'

vi.mock('~/composables/useAdminUsers', () => ({ useAdminUsers: vi.fn() }))
vi.mock('~~/src/api/admin/admin')

const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001'
const PROMOTE_USER_ID = '00000000-0000-0000-0000-000000000002'
const UNVERIFIED_USER_ID = '00000000-0000-0000-0000-000000000003'

const USERS: AdminUserListItem[] = [
  {
    id: ADMIN_USER_ID,
    email: 'root@readion.io',
    role: 'admin',
    emailVerified: true,
    createdAt: '2026-01-15T10:00:00.000Z',
    enrollmentCount: 0,
  },
  {
    id: PROMOTE_USER_ID,
    email: 'casey@org.io',
    role: 'user',
    emailVerified: true,
    createdAt: '2026-02-20T10:00:00.000Z',
    enrollmentCount: 3,
  },
  {
    id: UNVERIFIED_USER_ID,
    email: 'dana@org.io',
    role: 'user',
    emailVerified: false,
    createdAt: '2026-03-10T10:00:00.000Z',
    enrollmentCount: 1,
  },
]

const META: CollectionMeta = { total: 3, page: 1, limit: 20 }

function stubUsers(
  users: AdminUserListItem[] = USERS,
  options: { isLoading?: boolean; isError?: boolean } = {},
  meta: CollectionMeta = META,
) {
  vi.mocked(useAdminUsers).mockReturnValue({
    data: computed(() => ({ data: users, meta })),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    refetch: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
}

function mountUsers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(AdminUsers, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, invalidateSpy }
}

function rowFor(wrapper: ReturnType<typeof mountUsers>['wrapper'], userId: string) {
  return wrapper.find(`[data-testid="admin-user-row"][data-user-id="${userId}"]`)
}

const okEnvelope = (item: AdminUserListItem) => ({
  data: { data: { id: item.id, role: item.role } },
  status: 200,
  headers: new Headers(),
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdminUsers table render', () => {
  it('renders the page root and a row per user with email, role, join date and enrollment count', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="admin-users-page"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="admin-user-row"]')).toHaveLength(3)

    const caseyRow = rowFor(wrapper, PROMOTE_USER_ID)
    expect(caseyRow.find('[data-testid="user-email"]').text()).toContain('casey@org.io')
    expect(caseyRow.find('[data-testid="user-role"]').text()).toContain('User')
    expect(caseyRow.find('[data-testid="user-joined"]').text().length).toBeGreaterThan(0)
    expect(caseyRow.find('[data-testid="user-enrollments"]').text()).toContain('3')
  })

  it('renders a Certs column header instead of Enrollments', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers).toContain('Certs')
    expect(headers).not.toContain('Enrollments')
  })

  it('renders a Name and Last active column with a graceful placeholder', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    const caseyRow = rowFor(wrapper, PROMOTE_USER_ID)
    expect(caseyRow.find('[data-testid="user-name"]').text()).toBe('—')
    expect(caseyRow.find('[data-testid="user-last-active"]').text()).toBe('—')
  })

  it('derives the avatar initials from the email local part', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    const avatar = rowFor(wrapper, PROMOTE_USER_ID).find('[data-testid="user-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.text()).toBe('CA')
  })

  it('renders the admin row with a capitalized Admin role badge', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    expect(rowFor(wrapper, ADMIN_USER_ID).find('[data-testid="user-role"]').text()).toContain(
      'Admin',
    )
  })

  it('exposes a header-utility row with a search field, a disabled invite button, and a users/admins summary', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="user-search"]').exists()).toBe(true)

    const inviteBtn = wrapper.find('[data-testid="user-invite-btn"]')
    expect(inviteBtn.exists()).toBe(true)
    expect(inviteBtn.attributes('disabled')).toBeDefined()

    expect(wrapper.find('[data-testid="user-summary"]').text()).toBe('3 users · 1 admin')
  })

  it('sources the users count from meta.total rather than the current page size', () => {
    stubUsers(USERS, {}, { total: 23, page: 1, limit: 20 })
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="user-summary"]').text()).toBe('23 users · 1 admin')
  })

  it('exposes a Name and Last active column and a disabled Remove action per row', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="user-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-last-active"]').exists()).toBe(true)

    const removeBtn = rowFor(wrapper, PROMOTE_USER_ID).find('[data-testid="user-remove-btn"]')
    expect(removeBtn.exists()).toBe(true)
    expect(removeBtn.attributes('disabled')).toBeDefined()
  })

  it('renders only a single contextual role-toggle per row: promote for a user, demote for an admin', () => {
    stubUsers()
    const { wrapper } = mountUsers()

    const userRow = rowFor(wrapper, PROMOTE_USER_ID)
    expect(userRow.find('[data-testid="promote-user-btn"]').exists()).toBe(true)
    expect(userRow.find('[data-testid="demote-user-btn"]').exists()).toBe(false)

    const adminRow = rowFor(wrapper, ADMIN_USER_ID)
    expect(adminRow.find('[data-testid="demote-user-btn"]').exists()).toBe(true)
    expect(adminRow.find('[data-testid="promote-user-btn"]').exists()).toBe(false)
  })

  it('shows a loading state and no rows while the query is loading', () => {
    stubUsers([], { isLoading: true })
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="admin-users-loading"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="admin-user-row"]')).toHaveLength(0)
  })

  it('shows an error state when the query fails', () => {
    stubUsers([], { isError: true })
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="admin-users-error"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="admin-user-row"]')).toHaveLength(0)
  })
})

describe('AdminUsers pagination', () => {
  it('does not render a pagination control when meta reports a single page', () => {
    stubUsers(USERS, {}, { total: 3, page: 1, limit: 20 })
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="admin-users-pagination"]').exists()).toBe(false)
  })

  it('renders a pagination control when meta reports more than one page and advancing requests the next page', async () => {
    stubUsers(USERS, {}, { total: 23, page: 1, limit: 20 })
    const { wrapper } = mountUsers()

    expect(wrapper.find('[data-testid="admin-users-pagination"]').exists()).toBe(true)

    await wrapper.find('[data-testid="admin-users-pagination-next"]').trigger('click')
    await flushPromises()

    const pageArg = vi.mocked(useAdminUsers).mock.calls[0]?.[0]
    expect(toValue(pageArg ?? 1)).toBe(2)
  })
})

describe('AdminUsers promote', () => {
  it('promotes a non-admin and invalidates the users list', async () => {
    stubUsers()
    vi.mocked(adminControllerPromote).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope({ ...USERS[1], role: 'admin' } as AdminUserListItem) as any,
    )
    const { wrapper, invalidateSpy } = mountUsers()

    await rowFor(wrapper, PROMOTE_USER_ID).find('[data-testid="promote-user-btn"]').trigger('click')
    await flushPromises()

    expect(adminControllerPromote).toHaveBeenCalledTimes(1)
    expect(adminControllerPromote).toHaveBeenCalledWith(PROMOTE_USER_ID, expect.anything())
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.users() })
  })
})

describe('AdminUsers demote', () => {
  it('demotes an admin and invalidates the users list on success', async () => {
    stubUsers()
    vi.mocked(adminControllerDemote).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope({ ...USERS[0], role: 'user' } as AdminUserListItem) as any,
    )
    const { wrapper, invalidateSpy } = mountUsers()

    await rowFor(wrapper, ADMIN_USER_ID).find('[data-testid="demote-user-btn"]').trigger('click')
    await flushPromises()

    expect(adminControllerDemote).toHaveBeenCalledWith(ADMIN_USER_ID, expect.anything())
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.users() })
    expect(wrapper.find('[data-testid="demote-error"]').exists()).toBe(false)
  })

  it('surfaces an error and leaves the role on a 409 last-admin rejection', async () => {
    stubUsers()
    vi.mocked(adminControllerDemote).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Conflict',
        status: 409,
        detail: 'Cannot demote the last active admin.',
      }),
    )
    const { wrapper, invalidateSpy } = mountUsers()

    await rowFor(wrapper, ADMIN_USER_ID).find('[data-testid="demote-user-btn"]').trigger('click')
    await flushPromises()

    const error = wrapper.find('[data-testid="demote-error"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('last active admin')
    expect(rowFor(wrapper, ADMIN_USER_ID).find('[data-testid="user-role"]').text()).toContain(
      'Admin',
    )
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('falls back to the problem title when a 409 carries no detail', async () => {
    stubUsers()
    vi.mocked(adminControllerDemote).mockRejectedValue(
      new ReadionProblemDetailsError({ title: 'Conflict', status: 409 }),
    )
    const { wrapper } = mountUsers()

    await rowFor(wrapper, ADMIN_USER_ID).find('[data-testid="demote-user-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="demote-error"]').text()).toContain('Conflict')
  })

  it('does not surface a demote error for non-409 problem responses', async () => {
    stubUsers()
    vi.mocked(adminControllerDemote).mockRejectedValue(
      new ReadionProblemDetailsError({ title: 'Forbidden', status: 403 }),
    )
    const { wrapper } = mountUsers()

    await rowFor(wrapper, ADMIN_USER_ID).find('[data-testid="demote-user-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="demote-error"]').exists()).toBe(false)
  })

  it('ignores non-problem errors without surfacing a demote message', async () => {
    stubUsers()
    vi.mocked(adminControllerDemote).mockRejectedValue(new Error('network down'))
    const { wrapper } = mountUsers()

    await rowFor(wrapper, ADMIN_USER_ID).find('[data-testid="demote-user-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="demote-error"]').exists()).toBe(false)
  })
})
