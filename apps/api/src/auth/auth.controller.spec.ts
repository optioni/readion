import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import { AuthController } from './auth.controller'
import type { AuthService } from './auth.service'

type CookieCall = { name: string; value: string; options: Record<string, unknown> }

function makeResponse() {
  const cookies: CookieCall[] = []
  const cleared: CookieCall[] = []
  return {
    cookies,
    cleared,
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ name, value, options })
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      cleared.push({ name, value: '', options })
    },
  }
}

function controllerWith(cookieDomain: string | undefined, auth: Partial<AuthService>) {
  const config = { get: vi.fn().mockReturnValue(cookieDomain) } as unknown as ConfigService
  return new AuthController(auth as AuthService, config)
}

const session = {
  user: { id: 'u1', email: 'a@example.com' },
  accessToken: 'access',
  refreshToken: 'refresh',
}

describe('AuthController cookie scoping', () => {
  it('scopes the CSRF cookie to the configured parent domain on register', async () => {
    const controller = controllerWith('readion.app', {
      register: vi.fn().mockResolvedValue(session),
    })
    const response = makeResponse()

    await controller.register(
      { email: 'a@example.com', password: 'correcthorse', displayName: 'A' },
      response,
    )

    const csrf = response.cookies.find((c) => c.name === 'csrf_token')
    expect(csrf?.options.domain).toBe('readion.app')
  })

  it('leaves the CSRF cookie host-only when no domain is configured', async () => {
    const controller = controllerWith(undefined, {
      register: vi.fn().mockResolvedValue(session),
    })
    const response = makeResponse()

    await controller.register(
      { email: 'a@example.com', password: 'correcthorse', displayName: 'A' },
      response,
    )

    const csrf = response.cookies.find((c) => c.name === 'csrf_token')
    expect(csrf?.options).not.toHaveProperty('domain')
  })

  it('clears the CSRF cookie with the same domain so logout actually removes it', async () => {
    const controller = controllerWith('readion.app', {
      logout: vi.fn().mockResolvedValue({ success: true }),
    })
    const response = makeResponse()

    await controller.logout('refresh_token=refresh', response)

    const csrf = response.cleared.find((c) => c.name === 'csrf_token')
    expect(csrf?.options.domain).toBe('readion.app')
  })
})
