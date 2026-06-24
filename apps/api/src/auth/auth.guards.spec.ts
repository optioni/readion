import {
  type ContextType,
  type ExecutionContext,
  ForbiddenException,
  type Type,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { EnvConfig } from '../config/env.schema'
import { AccessTokenService } from './access-token.service'
import { JwtAuthGuard, Public, Roles, RolesGuard } from './auth.guards'

describe('auth guards', () => {
  it('JwtAuthGuard rejects unauthenticated requests, allows valid tokens, and honors @Public metadata', async () => {
    const tokenService = new AccessTokenService(
      new JwtService(),
      new ConfigService<EnvConfig>({ JWT_SECRET: 'test-secret' }),
    )
    vi.spyOn(tokenService, 'verify').mockResolvedValue({
      sub: 'user-1',
      role: 'user',
      iat: 1,
      exp: 2,
    })
    const guard = new JwtAuthGuard(new Reflector(), tokenService)
    const request = { headers: { authorization: 'Bearer access-token' } }

    await expect(guard.canActivate(contextFor({ request }))).resolves.toBe(true)
    expect(request).toMatchObject({ user: { id: 'user-1', role: 'user' } })
    await expect(
      guard.canActivate(contextFor({ request: { headers: {} } })),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    class Controller {
      @Public()
      handler() {}
    }
    const handler = Controller.prototype.handler
    await expect(
      guard.canActivate(contextFor({ handler, request: { headers: {} } })),
    ).resolves.toBe(true)
  })

  it('RolesGuard returns 401 before role checks and 403 for insufficient role', () => {
    const guard = new RolesGuard(new Reflector())

    class Controller {
      @Roles('admin')
      handler() {}
    }
    const handler = Controller.prototype.handler

    expect(() => guard.canActivate(contextFor({ handler, request: {} }))).toThrow(
      UnauthorizedException,
    )
    expect(() =>
      guard.canActivate(contextFor({ handler, request: { user: { id: 'user-1', role: 'user' } } })),
    ).toThrow(ForbiddenException)
    expect(
      guard.canActivate(
        contextFor({ handler, request: { user: { id: 'admin-1', role: 'admin' } } }),
      ),
    ).toBe(true)
  })
})

function contextFor(input: {
  handler?: () => void
  request: Record<string, unknown>
}): ExecutionContext {
  class TestController {}

  return {
    getArgs: () => {
      throw new Error('Arguments are not used in this test')
    },
    getArgByIndex: <T = unknown>() => undefined as T,
    switchToRpc: () => {
      throw new Error('RPC context is not used in this test')
    },
    switchToWs: () => {
      throw new Error('WS context is not used in this test')
    },
    getType: <TContext extends string = ContextType>(): TContext => 'http' as TContext,
    getHandler: () => input.handler ?? (() => undefined),
    getClass: <T = unknown>(): Type<T> => TestController as Type<T>,
    switchToHttp: () => ({
      getRequest: <T = Record<string, unknown>>(): T => input.request as T,
      getResponse: <T = unknown>(): T => undefined as T,
      getNext: <T = unknown>(): T => undefined as T,
    }),
  }
}
