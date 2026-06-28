import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readionQueryClient } from '~/lib/vue-query'
import { useAuthStore } from '~/stores/auth'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import { userCertificationsControllerList } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerGetMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/certifications/certifications')
vi.mock('~~/src/api/user-certifications/user-certifications')

type RouteLocation = { path: string }

const profileFixture = (role: 'user' | 'admin') => ({
  id: 'user-1',
  email: 'user@example.com',
  role,
  emailVerified: true,
  displayTimezone: 'Europe/Helsinki',
  sessionDefaults: {
    duration: 30,
    contentMix: 'balanced',
    difficulty: 'intermediate',
    focusArea: 'auto',
    learningStyle: 'weak-area-focus',
  },
})

const certificationRow = { id: 'cert-1' }
const enrollmentRow = { id: 'enr-1' }

const envelope = (rows: unknown) => ({
  data: { data: rows, meta: {} },
  status: 200,
  headers: new Headers(),
})

function mockApis(options: { role: 'user' | 'admin'; certs: unknown[]; enrollments: unknown[] }) {
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  vi.mocked(usersControllerGetMe).mockResolvedValue(envelope(profileFixture(options.role)) as any)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  vi.mocked(certificationsControllerList).mockResolvedValue(envelope(options.certs) as any)
  vi.mocked(userCertificationsControllerList).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    envelope(options.enrollments) as any,
  )
}

async function importMiddleware() {
  const mod = await import('~/middleware/onboarding.global')
  return mod.default as (to: RouteLocation, from: RouteLocation) => Promise<unknown>
}

async function runMiddleware(to: RouteLocation) {
  let redirected: unknown = null
  vi.stubGlobal('navigateTo', (dest: unknown) => {
    redirected = dest
    return dest
  })
  const middleware = await importMiddleware()
  await middleware(to, { path: '/other' })
  return redirected
}

function authenticate() {
  const auth = useAuthStore()
  auth.setSession('tok', null)
  auth.markReady()
  return auth
}

describe('onboarding global middleware', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    readionQueryClient.clear()
    vi.clearAllMocks()
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
  })

  afterEach(() => {
    readionQueryClient.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('bounces an enrolled user navigating to /onboarding back to /', async () => {
    authenticate()
    mockApis({ role: 'user', certs: [certificationRow], enrollments: [enrollmentRow] })

    const result = await runMiddleware({ path: '/onboarding' })
    expect(result).toBe('/')
  })

  it('routes a fresh user with 0 enrollments and >=1 cert from / to /onboarding', async () => {
    authenticate()
    mockApis({ role: 'user', certs: [certificationRow], enrollments: [] })

    const result = await runMiddleware({ path: '/' })
    expect(result).toBe('/onboarding')
  })

  it('routes a non-admin with 0 certs from / to /onboarding (empty state)', async () => {
    authenticate()
    mockApis({ role: 'user', certs: [], enrollments: [] })

    const result = await runMiddleware({ path: '/' })
    expect(result).toBe('/onboarding')
  })

  it('routes an admin with 0 certs from / to /admin/certifications', async () => {
    authenticate()
    mockApis({ role: 'admin', certs: [], enrollments: [] })

    const result = await runMiddleware({ path: '/' })
    expect(result).toBe('/admin/certifications')
  })

  it('leaves an enrolled user on / without redirect', async () => {
    authenticate()
    mockApis({ role: 'user', certs: [certificationRow], enrollments: [enrollmentRow] })

    const result = await runMiddleware({ path: '/' })
    expect(result).toBeNull()
  })

  it('returns early without fetching for an unauthenticated user', async () => {
    const auth = useAuthStore()
    auth.markReady()
    mockApis({ role: 'user', certs: [], enrollments: [] })

    const result = await runMiddleware({ path: '/onboarding' })
    expect(result).toBeNull()
    expect(usersControllerGetMe).not.toHaveBeenCalled()
  })

  it('ignores unrelated routes without fetching or redirecting', async () => {
    authenticate()
    mockApis({ role: 'user', certs: [], enrollments: [] })

    const result = await runMiddleware({ path: '/user-certifications/x' })
    expect(result).toBeNull()
    expect(usersControllerGetMe).not.toHaveBeenCalled()
  })
})
