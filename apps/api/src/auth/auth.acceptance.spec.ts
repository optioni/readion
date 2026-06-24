import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { User } from '@readion/db'
import supertest from 'supertest'
import {
  type AuthAcceptanceHarness,
  createAuthAcceptanceHarness,
  extractFirstUrl,
  getCookieHeader,
  getCookieValue,
  type SetCookieHeaders,
} from './test/auth-acceptance-harness'

describe('auth acceptance', () => {
  let harness: AuthAcceptanceHarness
  let app: INestApplication
  let em: EntityManager

  beforeAll(async () => {
    harness = await createAuthAcceptanceHarness()
    app = harness.app
    em = harness.moduleRef.get(EntityManager).fork()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
    em = harness.moduleRef.get(EntityManager).fork()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('registers an unverified account, sends verification mail, rejects weak passwords, and rejects duplicate email', async () => {
    const register = await registerUser(app, 'ada@example.com', 'correcthorse')

    expect(register.status).toBe(201)
    expect(register.body.data).toMatchObject({
      user: {
        id: expect.any(String),
        email: 'ada@example.com',
        role: 'admin',
        emailVerified: false,
      },
      accessToken: expect.any(String),
    })
    expect(register.body.data.user).not.toHaveProperty('password')
    expect(register.body.data.user).not.toHaveProperty('passwordHash')
    expect(register.body.data).not.toHaveProperty('refreshToken')
    expectRefreshCookie(register.headers['set-cookie'])
    expect(harness.mailMessages).toHaveLength(1)

    const verificationLink = extractFirstUrl(harness.mailMessages[0])
    expect(verificationLink.origin).toBe('http://localhost:3000')
    expect(verificationLink.searchParams.get('token')).toEqual(expect.any(String))

    const weak = await registerUser(app, 'weak@example.com', 'short')
    expect(weak.status).toBe(422)
    expect(weak.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
    )
    expect(await em.count(User, { email: 'weak@example.com' })).toBe(0)

    const duplicate = await registerUser(app, 'ADA@example.com', 'correcthorse')
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.detail).toMatch(/email/i)
    expect(await em.count(User, {})).toBe(1)
  })

  it('assigns admin to the first registered user and user to subsequent registrations', async () => {
    const first = await registerUser(app, 'first@example.com', 'correcthorse')
    const second = await registerUser(app, 'second@example.com', 'correcthorse')

    expect(first.status).toBe(201)
    expect(first.body.data.user.role).toBe('admin')
    expect(second.status).toBe(201)
    expect(second.body.data.user.role).toBe('user')
  })

  it('logs in with correct credentials and rejects wrong password and unknown email uniformly', async () => {
    const register = await registerUser(app, 'login@example.com', 'correcthorse')
    expect(register.status).toBe(201)

    const login = await loginUser(app, 'login@example.com', 'correcthorse')
    expect(login.status).toBe(200)
    expect(login.body.data.accessToken).toEqual(expect.any(String))
    expectRefreshCookie(login.headers['set-cookie'])

    const wrongPassword = await loginUser(app, 'login@example.com', 'incorrect')
    const unknownEmail = await loginUser(app, 'missing@example.com', 'incorrect')

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body.detail).toBe(unknownEmail.body.detail)
  })

  it('rotates refresh tokens, rejects replay, and logout invalidates the current session', async () => {
    const register = await registerUser(app, 'refresh@example.com', 'correcthorse')
    expect(register.status).toBe(201)
    const originalCookies = register.headers['set-cookie']

    const refresh = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieState(originalCookies))
      .set('X-CSRF-Token', csrfToken(originalCookies))

    expect(refresh.status).toBe(200)
    expect(refresh.body.data.accessToken).toEqual(expect.any(String))
    expectRefreshCookie(refresh.headers['set-cookie'])

    const replay = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieState(originalCookies))
      .set('X-CSRF-Token', csrfToken(originalCookies))
    expect(replay.status).toBe(401)

    const rotatedCookies = refresh.headers['set-cookie']
    const logout = await supertest(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refresh.body.data.accessToken}`)
      .set('Cookie', cookieState(rotatedCookies))
      .set('X-CSRF-Token', csrfToken(rotatedCookies))
    expect(logout.status).toBe(200)
    const logoutRefreshCookie = setCookieArray(logout.headers['set-cookie']).find((h) =>
      h.startsWith('refresh_token='),
    )
    expect(logoutRefreshCookie).toMatch(/Max-Age=0|Expires=/)

    const afterLogout = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieState(rotatedCookies))
      .set('X-CSRF-Token', csrfToken(rotatedCookies))
    expect(afterLogout.status).toBe(401)
  })

  it('verifies email once, resends for unverified users, and no-ops resend after verification', async () => {
    const register = await registerUser(app, 'verify@example.com', 'correcthorse')
    expect(register.status).toBe(201)
    const originalToken = latestMailToken(harness)

    const resend = await supertest(app.getHttpServer())
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${register.body.data.accessToken}`)
    expect(resend.status).toBe(200)
    expect(harness.mailMessages).toHaveLength(2)

    const oldToken = await supertest(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: originalToken })
    expect(oldToken.status).toBe(400)

    const verify = await supertest(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: latestMailToken(harness) })
    expect(verify.status).toBe(200)

    const persisted = await em.findOneOrFail(User, { email: 'verify@example.com' })
    expect(persisted.emailVerified).toBe(true)

    const repeatVerify = await supertest(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: latestMailToken(harness) })
    expect(repeatVerify.status).toBe(400)

    const resendVerified = await supertest(app.getHttpServer())
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${register.body.data.accessToken}`)
    expect(resendVerified.status).toBe(200)
    expect(harness.mailMessages).toHaveLength(2)
  })

  it('handles password reset without enumeration, validates reset token, updates password, and revokes sessions', async () => {
    const register = await registerUser(app, 'reset@example.com', 'correcthorse')
    expect(register.status).toBe(201)
    const oldRefreshCookies = register.headers['set-cookie']

    const existing = await supertest(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
    expect(existing.status).toBe(202)
    expect(harness.mailMessages).toHaveLength(2)
    const resetToken = latestMailToken(harness)

    const unknown = await supertest(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'missing@example.com' })
    expect(unknown.status).toBe(202)
    expect(unknown.body).toEqual(existing.body)
    expect(harness.mailMessages).toHaveLength(2)

    const validate = await supertest(app.getHttpServer()).get(
      `/api/v1/auth/reset-password?token=${resetToken}`,
    )
    expect(validate.status).toBe(200)

    const reset = await supertest(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'newcorrecthorse' })
    expect(reset.status).toBe(200)

    expect((await loginUser(app, 'reset@example.com', 'correcthorse')).status).toBe(401)
    expect((await loginUser(app, 'reset@example.com', 'newcorrecthorse')).status).toBe(200)

    const oldSessionRefresh = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieState(oldRefreshCookies))
      .set('X-CSRF-Token', csrfToken(oldRefreshCookies))
    expect(oldSessionRefresh.status).toBe(401)

    const reusedReset = await supertest(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'anothercorrecthorse' })
    expect(reusedReset.status).toBe(400)
  })

  it('sets secure refresh cookie attributes and never exposes refresh tokens in response bodies', async () => {
    const register = await registerUser(app, 'cookies@example.com', 'correcthorse')
    expect(register.status).toBe(201)
    const setCookie = register.headers['set-cookie']
    const refreshCookieValue = getCookieValue(setCookie, 'refresh_token')

    expectRefreshCookie(setCookie)
    expect(getCookieHeader(setCookie, 'access_token')).toBeUndefined()
    expect(refreshCookieValue).toEqual(expect.any(String))
    expect(JSON.stringify(register.body)).not.toContain(refreshCookieValue)
  })

  it('rejects the 11th login request within 15 minutes with 429', async () => {
    for (let i = 0; i < 10; i++) {
      await loginUser(app, 'throttle@example.com', 'anycredentials')
    }

    const over = await loginUser(app, 'throttle@example.com', 'anycredentials')
    expect(over.status).toBe(429)
    expect(over.body.type).toBe('/errors/too-many-requests')
    expect(over.headers['retry-after']).toBeDefined()
  })
})

function registerUser(app: INestApplication, email: string, password: string) {
  return supertest(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password })
}

function loginUser(app: INestApplication, email: string, password: string) {
  return supertest(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password })
}

function cookieState(setCookieHeaders: SetCookieHeaders) {
  return [
    getCookieHeader(setCookieHeaders, 'refresh_token') ?? '',
    getCookieHeader(setCookieHeaders, 'csrf_token') ?? '',
  ]
}

function csrfToken(setCookieHeaders: SetCookieHeaders) {
  const token = getCookieValue(setCookieHeaders, 'csrf_token')

  if (token === undefined) {
    throw new Error('Missing csrf_token cookie')
  }

  return token
}

function latestMailToken(harness: AuthAcceptanceHarness) {
  const message = harness.mailMessages[harness.mailMessages.length - 1]

  if (message === undefined) {
    throw new Error('No captured mail message')
  }

  const token = extractFirstUrl(message).searchParams.get('token')

  if (token === null) {
    throw new Error('Captured mail did not include a token param')
  }

  return token
}

function expectRefreshCookie(setCookieHeaders: SetCookieHeaders) {
  const refreshCookie = setCookieArray(setCookieHeaders).find((header) =>
    header.startsWith('refresh_token='),
  )

  expect(refreshCookie).toEqual(expect.any(String))
  expect(refreshCookie).toContain('HttpOnly')
  expect(refreshCookie).toContain('Secure')
  expect(refreshCookie).toContain('SameSite=Lax')
}

function setCookieArray(setCookieHeaders: SetCookieHeaders) {
  if (setCookieHeaders === undefined) {
    return []
  }

  return Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
}
