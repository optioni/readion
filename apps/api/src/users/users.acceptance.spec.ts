import { EntityManager } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import { User, UserRole } from '@readion/db'
import supertest from 'supertest'
import {
  type AuthAcceptanceHarness,
  createAuthAcceptanceHarness,
  getCookieHeader,
  getCookieValue,
  type SetCookieHeaders,
} from '../auth/test/auth-acceptance-harness'

describe('users acceptance', () => {
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

  it('GET /api/v1/users/me returns the authenticated profile and rejects anonymous reads', async () => {
    const register = await registerUser(app, 'profile@example.com', 'correcthorse')
    expect(register.status).toBe(201)

    const anonymous = await supertest(app.getHttpServer()).get('/api/v1/users/me')
    expect(anonymous.status).toBe(401)

    const profile = await supertest(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${register.body.data.accessToken}`)

    expect(profile.status).toBe(200)
    expect(profile.body.data).toMatchObject({
      id: register.body.data.user.id,
      email: 'profile@example.com',
      role: 'admin',
      emailVerified: false,
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults: {
        duration: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: 'auto',
        learningStyle: 'weak-area-focus',
      },
    })
    expect(profile.body.data).not.toHaveProperty('passwordHash')
  })

  it('PATCH /api/v1/users/me updates profile preferences and rejects invalid input', async () => {
    const register = await registerUser(app, 'patch-profile@example.com', 'correcthorse')
    expect(register.status).toBe(201)
    const authorization = `Bearer ${register.body.data.accessToken}`

    const update = await supertest(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', authorization)
      .send({
        displayTimezone: 'America/New_York',
        sessionDefaults: {
          duration: 60,
          learningStyle: 'spaced-repetition',
        },
      })

    expect(update.status).toBe(200)
    expect(update.body.data).toMatchObject({
      email: 'patch-profile@example.com',
      displayTimezone: 'America/New_York',
      sessionDefaults: {
        duration: 60,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: 'auto',
        learningStyle: 'spaced-repetition',
      },
    })

    const invalidTimezone = await supertest(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', authorization)
      .send({ displayTimezone: 'Mars/Olympus' })
    expect(invalidTimezone.status).toBe(422)

    const invalidPreference = await supertest(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', authorization)
      .send({ sessionDefaults: { duration: 45 } })
    expect(invalidPreference.status).toBe(422)

    const immutable = await supertest(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', authorization)
      .send({
        email: 'new@example.com',
        role: 'user',
        emailVerified: true,
      })
    expect(immutable.status).toBe(200)

    const persisted = await em.findOneOrFail(User, { id: register.body.data.user.id })
    expect(persisted.email).toBe('patch-profile@example.com')
    expect(persisted.role).toBe('admin')
    expect(persisted.emailVerified).toBe(false)
  })

  it('DELETE /api/v1/users/me soft-deletes an account, revokes tokens, and releases email', async () => {
    const admin = await registerUser(app, 'admin@example.com', 'correcthorse')
    expect(admin.status).toBe(201)
    const register = await registerUser(app, 'delete-me@example.com', 'correcthorse')
    expect(register.status).toBe(201)
    const authorization = `Bearer ${register.body.data.accessToken}`
    const originalCookies = register.headers['set-cookie']

    const wrongPassword = await supertest(app.getHttpServer())
      .delete('/api/v1/users/me')
      .set('Authorization', authorization)
      .send({ password: 'wrong-password' })
    expect(wrongPassword.status).toBe(401)

    const beforeDelete = await em.findOneOrFail(User, { id: register.body.data.user.id })
    expect(beforeDelete.deletedAt).toBeNull()

    const deletion = await supertest(app.getHttpServer())
      .delete('/api/v1/users/me')
      .set('Authorization', authorization)
      .send({ password: 'correcthorse' })
    expect(deletion.status).toBe(204)
    expect(deletion.body).toEqual({})

    em.clear()
    const deleted = await em.findOneOrFail(User, { id: register.body.data.user.id })
    expect(deleted.deletedAt).toBeInstanceOf(Date)

    const loginAfterDelete = await loginUser(app, 'delete-me@example.com', 'correcthorse')
    expect(loginAfterDelete.status).toBe(401)

    const refreshAfterDelete = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieState(originalCookies))
      .set('X-CSRF-Token', csrfToken(originalCookies))
    expect(refreshAfterDelete.status).toBe(401)

    const reRegister = await registerUser(app, 'delete-me@example.com', 'correcthorse')
    expect(reRegister.status).toBe(201)
    expect(reRegister.body.data.user.id).not.toBe(register.body.data.user.id)
  })

  it('DELETE /api/v1/users/me blocks the last admin and allows admin deletion when another admin exists', async () => {
    const onlyAdmin = await registerUser(app, 'only-admin@example.com', 'correcthorse')
    expect(onlyAdmin.status).toBe(201)

    const blocked = await supertest(app.getHttpServer())
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${onlyAdmin.body.data.accessToken}`)
      .send({ password: 'correcthorse' })
    expect(blocked.status).toBe(409)

    await harness.resetState()
    em = harness.moduleRef.get(EntityManager).fork()

    const firstAdmin = await registerUser(app, 'first-admin@example.com', 'correcthorse')
    const secondAdmin = await registerUser(app, 'second-admin@example.com', 'correcthorse')
    expect(firstAdmin.status).toBe(201)
    expect(secondAdmin.status).toBe(201)
    const promoted = await em.findOneOrFail(User, { id: secondAdmin.body.data.user.id })
    promoted.role = UserRole.Admin
    await em.flush()

    const allowed = await supertest(app.getHttpServer())
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${firstAdmin.body.data.accessToken}`)
      .send({ password: 'correcthorse' })
    expect(allowed.status).toBe(204)
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
