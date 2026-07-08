import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('admin index redirect middleware', () => {
  beforeEach(() => {
    vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('redirects the bare /admin index to /admin/certifications', async () => {
    let redirected: unknown = null
    vi.stubGlobal('navigateTo', (dest: unknown) => {
      redirected = dest
      return dest
    })

    const mod = await import('~/middleware/admin-index-redirect')
    const middleware = mod.default as (
      to: { path: string },
      from: { path: string },
    ) => Promise<unknown> | unknown
    await middleware({ path: '/admin' }, { path: '/other' })

    expect(redirected).toBe('/admin/certifications')
  })
})
