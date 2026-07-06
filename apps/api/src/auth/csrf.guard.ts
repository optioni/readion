import { randomBytes } from 'node:crypto'
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

export type AuthCookieOptions = {
  httpOnly?: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
}

export const REFRESH_COOKIE_NAME = 'refresh_token'
export const CSRF_COOKIE_NAME = 'csrf_token'
export const CSRF_HEADER_NAME = 'x-csrf-token'

type CsrfRequest = {
  method: string
  cookies?: Record<string, string | undefined>
  headers?: Record<string, string | undefined>
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const CSRF_EXEMPT_KEY = 'auth:csrf-exempt'

// Session-establishing endpoints authenticate via body credentials, not ambient cookies, so the
// double-submit check is meaningless there. Gating them also creates an unrecoverable lockout: a
// lingering refresh_token cookie without a matching csrf_token cookie would permanently block login.
export const CsrfExempt = () => SetMetadata(CSRF_EXEMPT_KEY, true)

export function createCsrfToken() {
  return randomBytes(32).toString('base64url')
}

export function buildRefreshCookie(value: string) {
  return {
    name: REFRESH_COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    } satisfies AuthCookieOptions,
  }
}

export function buildCsrfCookie(value: string) {
  return {
    name: CSRF_COOKIE_NAME,
    value,
    options: {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
    } satisfies AuthCookieOptions,
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (this.isExempt(context)) {
      return true
    }

    const request = context.switchToHttp().getRequest<CsrfRequest>()

    if (SAFE_METHODS.has(request.method.toUpperCase()) || !this.hasRefreshCookie(request)) {
      return true
    }

    const cookies = this.getCookies(request)
    const csrfCookie = cookies[CSRF_COOKIE_NAME]
    const csrfHeader = request.headers?.[CSRF_HEADER_NAME]

    if (!csrfCookie || csrfHeader !== csrfCookie) {
      throw new ForbiddenException('CSRF token mismatch')
    }

    return true
  }

  private isExempt(context: ExecutionContext) {
    return (
      this.reflector.getAllAndOverride<boolean>(CSRF_EXEMPT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    )
  }

  private hasRefreshCookie(request: CsrfRequest) {
    return this.getCookies(request)[REFRESH_COOKIE_NAME] !== undefined
  }

  private getCookies(request: CsrfRequest) {
    if (request.cookies !== undefined) {
      return request.cookies
    }

    const header = request.headers?.cookie

    if (header === undefined) {
      return {}
    }

    return Object.fromEntries(
      header.split(';').map((part) => {
        const [name, ...valueParts] = part.trim().split('=')
        return [name, valueParts.join('=')]
      }),
    )
  }
}
