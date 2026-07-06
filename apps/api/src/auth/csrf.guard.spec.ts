import { type ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { buildCsrfCookie, buildRefreshCookie, CsrfGuard, createCsrfToken } from './csrf.guard'

const guardWith = (exempt = false) =>
  new CsrfGuard({ getAllAndOverride: () => exempt } as unknown as Reflector)

describe('CsrfGuard', () => {
  it('rejects cookie-authenticated state changes without a matching double-submit token', () => {
    const guard = guardWith()

    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'POST',
          cookies: { refresh_token: 'refresh-token', csrf_token: 'csrf-token' },
          headers: {},
        }),
      ),
    ).toThrow(ForbiddenException)

    expect(
      guard.canActivate(
        contextFor({
          method: 'POST',
          cookies: { refresh_token: 'refresh-token', csrf_token: 'csrf-token' },
          headers: { 'x-csrf-token': 'csrf-token' },
        }),
      ),
    ).toBe(true)
  })

  it('allows safe methods and state changes without refresh-cookie authentication', () => {
    const guard = guardWith()

    expect(guard.canActivate(contextFor({ method: 'GET', cookies: {}, headers: {} }))).toBe(true)
    expect(guard.canActivate(contextFor({ method: 'POST', cookies: {}, headers: {} }))).toBe(true)
  })

  it('allows exempt handlers even when a refresh cookie is present without a csrf token', () => {
    const guard = guardWith(true)

    expect(
      guard.canActivate(
        contextFor({ method: 'POST', cookies: { refresh_token: 'stale' }, headers: {} }),
      ),
    ).toBe(true)
  })

  it('creates non-empty CSRF token values for cookie issuance', () => {
    expect(createCsrfToken()).toEqual(expect.any(String))
  })

  it('builds refresh and CSRF cookie definitions', () => {
    expect(buildRefreshCookie('refresh-token')).toMatchObject({
      name: 'refresh_token',
      value: 'refresh-token',
      options: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      },
    })
    expect(buildCsrfCookie('csrf-token')).toMatchObject({
      name: 'csrf_token',
      value: 'csrf-token',
      options: {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
      },
    })
  })

  it('omits the domain from the CSRF cookie when none is configured', () => {
    expect(buildCsrfCookie('csrf-token').options).not.toHaveProperty('domain')
  })

  it('scopes the CSRF cookie to a parent domain so cross-subdomain JS can read it', () => {
    expect(buildCsrfCookie('csrf-token', 'readion.app').options).toMatchObject({
      domain: 'readion.app',
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
    })
  })
})

function contextFor(input: {
  method: string
  cookies: Record<string, string | undefined>
  headers: Record<string, string | undefined>
}): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => input,
    }),
  } as unknown as ExecutionContext
}
