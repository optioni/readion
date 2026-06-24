import { type APIRequestContext, expect, request, test } from '@playwright/test'

const { createReadionE2eHarness } = require('./support/readion-e2e-harness.cjs') as {
  createReadionE2eHarness: () => Promise<{
    apiBaseUrl: string
    registerVerifiedUser: (
      api: APIRequestContext,
      email?: string,
    ) => Promise<{ accessToken: string; email: string; password: string }>
    resetState: () => Promise<void>
    teardown: () => Promise<void>
  }>
}

test.describe('users account lifecycle', () => {
  let harness: Awaited<ReturnType<typeof createReadionE2eHarness>>
  let api: APIRequestContext

  test.beforeAll(async () => {
    harness = await createReadionE2eHarness()
    api = await request.newContext({ baseURL: harness.apiBaseUrl })
  })

  test.beforeEach(async () => {
    await harness.resetState()
  })

  test.afterAll(async () => {
    await api?.dispose()
    await harness?.teardown()
  })

  test('authenticated user manages their own profile and deletes their account', async () => {
    await harness.registerVerifiedUser(api, `owner.${Date.now()}@example.com`)
    const user = await harness.registerVerifiedUser(api)

    const profile = await api.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })

    expect(profile.status()).toBe(200)
    const profileBody = await profile.json()
    expect(profileBody.data).toMatchObject({
      email: user.email,
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults: {
        duration: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: 'auto',
        learningStyle: 'weak-area-focus',
      },
    })
    expect(profileBody.data).not.toHaveProperty('passwordHash')

    const update = await api.patch('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      data: {
        displayTimezone: 'America/New_York',
        sessionDefaults: {
          duration: 60,
          learningStyle: 'spaced-repetition',
        },
      },
    })

    expect(update.status()).toBe(200)
    const updateBody = await update.json()
    expect(updateBody.data).toMatchObject({
      displayTimezone: 'America/New_York',
      sessionDefaults: {
        duration: 60,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: 'auto',
        learningStyle: 'spaced-repetition',
      },
    })

    const deletion = await api.delete('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      data: { password: user.password },
    })

    expect(deletion.status()).toBe(204)

    const loginAfterDeletion = await api.post('/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    })

    expect(loginAfterDeletion.status()).toBe(401)
  })
})
