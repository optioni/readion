import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { ValidationErrorItem } from '@readion/shared'
import {
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  passwordResetRequestSchema,
  registerRequestSchema,
} from '@readion/shared'
import type { z } from 'zod'
import { AuthThrottle } from '../throttler/throttler.decorators'
import { CurrentUser, type CurrentUserPrincipal, Public } from './auth.guards'
import { AuthService } from './auth.service'
import {
  type AuthCookieOptions,
  buildCsrfCookie,
  buildRefreshCookie,
  CSRF_COOKIE_NAME,
  createCsrfToken,
  REFRESH_COOKIE_NAME,
} from './csrf.guard'

type CookieResponse = {
  cookie(name: string, value: string, options: AuthCookieOptions): void
  clearCookie(name: string, options: AuthCookieOptions): void
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @AuthThrottle()
  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) response: CookieResponse) {
    const session = await this.auth.register(parseBody(registerRequestSchema, body))
    this.setSessionCookies(response, session.refreshToken)
    return { user: session.user, accessToken: session.accessToken }
  }

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: CookieResponse) {
    const session = await this.auth.login(parseBody(loginRequestSchema, body))
    this.setSessionCookies(response, session.refreshToken)
    return { user: session.user, accessToken: session.accessToken }
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Headers('cookie') cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const session = await this.auth.refresh(requiredCookie(cookieHeader, REFRESH_COOKIE_NAME))
    this.setSessionCookies(response, session.refreshToken)
    return { accessToken: session.accessToken }
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(
    @Headers('cookie') cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.auth.logout(readCookie(cookieHeader, REFRESH_COOKIE_NAME))
    this.clearSessionCookies(response)
    return result
  }

  @Public()
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() body: unknown) {
    const token = parseTokenBody(body)
    return this.auth.verifyEmail(token)
  }

  @HttpCode(200)
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: CurrentUserPrincipal) {
    return this.auth.resendVerification(user.id)
  }

  @AuthThrottle()
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: CurrentUserPrincipal,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const session = await this.auth.changePassword(
      user.id,
      parseBody(changePasswordRequestSchema, body),
    )
    this.setSessionCookies(response, session.refreshToken)
    return { accessToken: session.accessToken }
  }

  @Public()
  @HttpCode(202)
  @Post('forgot-password')
  forgotPassword(@Body() body: unknown) {
    return this.auth.forgotPassword(parseBody(forgotPasswordRequestSchema, body).email)
  }

  @Public()
  @Get('reset-password')
  validateResetPassword(@Query('token') token: string | undefined) {
    return this.auth.validateResetToken(parseToken(token))
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() body: unknown) {
    return this.auth.resetPassword(parseBody(passwordResetRequestSchema, body))
  }

  private setSessionCookies(response: CookieResponse, refreshToken: string) {
    const refresh = buildRefreshCookie(refreshToken)
    const csrf = buildCsrfCookie(createCsrfToken())
    response.cookie(refresh.name, refresh.value, refresh.options)
    response.cookie(csrf.name, csrf.value, csrf.options)
  }

  private clearSessionCookies(response: CookieResponse) {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
    response.clearCookie(CSRF_COOKIE_NAME, {
      path: '/',
      secure: true,
      sameSite: 'lax',
    })
  }
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)

  if (!result.success) {
    throw new UnprocessableEntityException({
      errors: result.error.issues.map(toValidationError),
    })
  }

  return result.data
}

type ZodIssueLike = {
  path: PropertyKey[]
  message: string
}

function toValidationError(issue: ZodIssueLike): ValidationErrorItem {
  return {
    field: issue.path.map(String).join('.') || 'body',
    message: issue.message,
  }
}

function parseTokenBody(body: unknown) {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('token' in body) ||
    typeof body.token !== 'string' ||
    body.token.length === 0
  ) {
    throw new UnprocessableEntityException({
      errors: [{ field: 'token', message: 'token is required' }],
    })
  }

  return body.token
}

function parseToken(token: string | undefined) {
  if (token === undefined || token.length === 0) {
    throw new UnprocessableEntityException({
      errors: [{ field: 'token', message: 'token is required' }],
    })
  }

  return token
}

function requiredCookie(cookieHeader: string | undefined, name: string) {
  const value = readCookie(cookieHeader, name)

  if (value === null) {
    throw new UnauthorizedException('Authentication required')
  }

  return value
}

function readCookie(cookieHeader: string | undefined, name: string) {
  const cookies = parseCookieHeader(cookieHeader)
  return cookies.get(name) ?? null
}

function parseCookieHeader(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>()

  if (cookieHeader === undefined) {
    return cookies
  }

  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=')

    if (name) {
      cookies.set(name, valueParts.join('='))
    }
  }

  return cookies
}
