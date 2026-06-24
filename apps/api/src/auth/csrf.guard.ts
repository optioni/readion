import { randomBytes } from 'node:crypto'
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

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
  canActivate(context: ExecutionContext) {
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
