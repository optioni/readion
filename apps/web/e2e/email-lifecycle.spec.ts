import { type APIRequestContext, expect, request, test } from '@playwright/test'

type CapturedMail = { from: string; to: string; subject: string; text: string; html: string }

type SeededEnrollment = {
  userId: string
  enrollmentId: string
  certificationId: string
  weakestDomain: string
  dueReviewCount: number
}

const { createReadionE2eHarness } = require('./support/readion-e2e-harness.cjs') as {
  createReadionE2eHarness: () => Promise<{
    apiBaseUrl: string
    mailMessages: CapturedMail[]
    registerVerifiedUser: (
      api: APIRequestContext,
      email?: string,
    ) => Promise<{ accessToken: string; email: string; password: string }>
    seedCalibratedEnrollment: (email: string) => Promise<SeededEnrollment>
    resetState: () => Promise<void>
    teardown: () => Promise<void>
  }>
}

const INTERNAL_SECRET_HEADER = 'x-internal-api-secret'
const INTERNAL_API_SECRET = 'test-internal-secret'

test.describe('email lifecycle', () => {
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

  // Spec: "Welcome email on registration" → "Successful registration sends one welcome email".
  test('successful registration captures exactly one welcome email', async () => {
    const email = `welcome.${Date.now()}@example.com`

    const register = await api.post('/api/v1/auth/register', {
      data: { email, password: 'correcthorse' },
    })
    expect(register.status()).toBe(201)

    // Registration also sends the verification email; the welcome email is the
    // separate, non-verification message addressed to the new user.
    const userMail = harness.mailMessages.filter((message) => message.to.includes(email))
    const welcomeMail = userMail.filter((message) => !/verify/i.test(message.subject))

    expect(welcomeMail).toHaveLength(1)
    const welcome = welcomeMail[0]!
    expect(welcome.from).toContain('readion.app')
    expect(welcome.subject.length).toBeGreaterThan(0)
    expect(welcome.text.length).toBeGreaterThan(0)
    expect(welcome.html.length).toBeGreaterThan(0)
  })

  // Spec: "Weekly progress digest content" + "One-click unsubscribe".
  test('digest internal endpoint sends a progress digest and unsubscribe opts the user out', async () => {
    const user = await harness.registerVerifiedUser(api)
    const seed = await harness.seedCalibratedEnrollment(user.email)

    const trigger = await api.post('/internal/lifecycle/digest', {
      headers: { [INTERNAL_SECRET_HEADER]: INTERNAL_API_SECRET },
      data: { userIds: [seed.userId] },
    })
    expect(trigger.ok()).toBe(true)

    const digest = harness.mailMessages.find(
      (message) => message.to.includes(user.email) && !/verify/i.test(message.subject),
    )
    expect(digest, 'a digest email should be captured for the due user').toBeDefined()

    const body = `${digest!.text}\n${digest!.html}`
    expect(body).toContain(seed.weakestDomain)
    expect(body, 'readiness percentage').toMatch(/\d+\s*%/)
    expect(body, 'weekly delta').toMatch(/[+-]\s?\d+/)
    expect(body, 'due-review count').toContain(String(seed.dueReviewCount))

    const linkMatch = body.match(/https?:\/\/\S*unsubscribe\S*/i)
    expect(linkMatch, 'an unsubscribe link should be present').not.toBeNull()

    const link = new URL(linkMatch![0])
    const unsubscribe = await api.get(`${link.pathname}${link.search}`)
    expect(unsubscribe.ok()).toBe(true)

    // After opting out, a second digest trigger must not send another digest.
    const before = harness.mailMessages.length
    const second = await api.post('/internal/lifecycle/digest', {
      headers: { [INTERNAL_SECRET_HEADER]: INTERNAL_API_SECRET },
      data: { userIds: [seed.userId] },
    })
    expect(second.ok()).toBe(true)
    expect(harness.mailMessages.length).toBe(before)
  })

  // Spec: "Post-exam outcome nudge trigger" + "Exam-outcome survey response capture".
  test('nudge internal endpoint sends a survey and exam-outcome records without changing readiness', async () => {
    const user = await harness.registerVerifiedUser(api)
    const seed = await harness.seedCalibratedEnrollment(user.email)
    const auth = { Authorization: `Bearer ${user.accessToken}` }

    const readinessBefore = await api.get(
      `/api/v1/user-certifications/${seed.enrollmentId}/readiness`,
      { headers: auth },
    )
    expect(readinessBefore.status()).toBe(200)
    const before = await readinessBefore.json()

    const trigger = await api.post('/internal/lifecycle/nudge', {
      headers: { [INTERNAL_SECRET_HEADER]: INTERNAL_API_SECRET },
      data: { userCertificationIds: [seed.enrollmentId] },
    })
    expect(trigger.ok()).toBe(true)

    const survey = harness.mailMessages.find(
      (message) =>
        message.to.includes(user.email) &&
        /exam|passed|survey|outcome/i.test(`${message.subject} ${message.text}`),
    )
    expect(survey, 'a post-exam survey email should be captured').toBeDefined()
    expect(`${survey!.text} ${survey!.html}`).toMatch(/passed/i)

    const record = await api.post(`/api/v1/user-certifications/${seed.enrollmentId}/exam-outcome`, {
      headers: auth,
      data: { response: 'passed' },
    })
    expect(record.ok()).toBe(true)

    const readinessAfter = await api.get(
      `/api/v1/user-certifications/${seed.enrollmentId}/readiness`,
      { headers: auth },
    )
    expect(readinessAfter.status()).toBe(200)
    const after = await readinessAfter.json()
    expect(after.data).toEqual(before.data)
  })

  // Spec: "Internal lifecycle-email trigger endpoints are guarded".
  test('internal lifecycle endpoints reject a missing or wrong secret', async () => {
    const user = await harness.registerVerifiedUser(api)
    const seed = await harness.seedCalibratedEnrollment(user.email)

    const noSecret = await api.post('/internal/lifecycle/digest', {
      data: { userIds: [seed.userId] },
    })
    expect([401, 403]).toContain(noSecret.status())

    const wrongSecret = await api.post('/internal/lifecycle/nudge', {
      headers: { [INTERNAL_SECRET_HEADER]: 'not-the-secret' },
      data: { userCertificationIds: [seed.enrollmentId] },
    })
    expect([401, 403]).toContain(wrongSecret.status())

    const userMail = harness.mailMessages.filter(
      (message) => message.to.includes(user.email) && !/verify/i.test(message.subject),
    )
    expect(userMail).toHaveLength(0)
  })
})
