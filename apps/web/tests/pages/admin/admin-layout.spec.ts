import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCertificationsPage from '~/pages/admin/certifications/index.vue'
import AdminNewCertPage from '~/pages/admin/certifications/new.vue'
import AdminIndexPage from '~/pages/admin/index.vue'
import AdminAuditLogsPage from '~/pages/admin/audit-logs.vue'
import AdminReviewQueuePage from '~/pages/admin/review-queue.vue'
import AdminSourcesPage from '~/pages/admin/sources.vue'
import AdminUsersPage from '~/pages/admin/users.vue'

let definePageMetaSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  definePageMetaSpy = vi.fn()
  vi.stubGlobal('definePageMeta', definePageMetaSpy)
  vi.stubGlobal('useRoute', () => ({ path: '/admin' }))
  vi.stubGlobal('navigateTo', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe.each([
  ['index', AdminIndexPage],
  ['certifications index', AdminCertificationsPage],
  ['certifications new', AdminNewCertPage],
  ['users', AdminUsersPage],
  ['audit-logs', AdminAuditLogsPage],
  ['sources', AdminSourcesPage],
  ['review-queue', AdminReviewQueuePage],
])('%s admin page', (_name, Page) => {
  it('opts into the dedicated admin layout instead of the default learner shell', () => {
    shallowMount(Page)

    expect(definePageMetaSpy).toHaveBeenCalledWith(expect.objectContaining({ layout: 'admin' }))
  })
})
