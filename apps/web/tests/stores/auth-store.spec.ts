import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AuthUser, useAuthStore } from '~/stores/auth'

describe('auth Pinia store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Storage.prototype, 'setItem')
    vi.spyOn(Storage.prototype, 'getItem')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts unauthenticated with no token or user', () => {
    const auth = useAuthStore()
    expect(auth.accessToken).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('isAuthenticated reflects token presence', () => {
    const auth = useAuthStore()
    auth.setSession('token-abc', null)
    expect(auth.isAuthenticated).toBe(true)
    auth.clear()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('access token is never written to localStorage or sessionStorage', () => {
    const auth = useAuthStore()
    auth.setSession('secret-token', null)
    expect(Storage.prototype.setItem).not.toHaveBeenCalledWith(expect.any(String), 'secret-token')
    expect(auth.accessToken).toBe('secret-token')
  })

  it('setSession stores token and user in reactive state', () => {
    const auth = useAuthStore()
    const user: AuthUser = {
      id: '1',
      email: 'a@b.com',
      emailVerified: true,
      displayTimezone: 'UTC',
      createdAt: new Date().toISOString(),
    }
    auth.setSession('tok', user)
    expect(auth.accessToken).toBe('tok')
    expect(auth.user).toEqual(user)
  })

  it('clear removes token and user', () => {
    const auth = useAuthStore()
    auth.setSession('tok', {
      id: '1',
      email: 'x@y.com',
      emailVerified: false,
      displayTimezone: 'UTC',
      createdAt: '',
    })
    auth.clear()
    expect(auth.accessToken).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('setUser hydrates the user without affecting the token', () => {
    const auth = useAuthStore()
    auth.setSession('tok', null)
    const user: AuthUser = {
      id: '2',
      email: 'c@d.com',
      emailVerified: true,
      displayTimezone: 'UTC',
      createdAt: '',
    }
    auth.setUser(user)
    expect(auth.user).toEqual(user)
    expect(auth.accessToken).toBe('tok')
  })

  it('ready promise resolves after markReady is called', async () => {
    const auth = useAuthStore()
    let resolved = false
    const waitPromise = auth.ready.then(() => {
      resolved = true
    })
    expect(resolved).toBe(false)
    auth.markReady()
    await waitPromise
    expect(resolved).toBe(true)
  })
})
