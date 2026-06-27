import { EntityManager } from '@mikro-orm/core'
import { User } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createLifecycleEmailAcceptanceHarness,
  type LifecycleEmailAcceptanceHarness,
} from './test/lifecycle-email-acceptance-harness'

const UNSUBSCRIBE_PATH = '/api/v1/email/unsubscribe'

describe('Email unsubscribe (integration)', () => {
  let harness: LifecycleEmailAcceptanceHarness
  let em: EntityManager

  beforeAll(async () => {
    harness = await createLifecycleEmailAcceptanceHarness()
    em = harness.moduleRef.get(EntityManager)
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  async function seedUserWithToken(email: string, token: string): Promise<string> {
    const accessToken = await harness.registerAndLogin(email, 'correcthorse')
    const userId = await harness.getUserIdFromToken(accessToken)
    const fork = em.fork()
    const user = await fork.findOneOrFail(User, { id: userId })
    user.unsubscribeToken = token
    await fork.flush()
    return userId
  }

  it('opts a user out with a valid token without any auth and returns a generic confirmation', async () => {
    const userId = await seedUserWithToken('valid-unsub@example.com', 'token-valid-123')

    const res = await harness.getRequest().get(`${UNSUBSCRIBE_PATH}?token=token-valid-123`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ unsubscribed: true })

    const fork = em.fork()
    const user = await fork.findOneOrFail(User, { id: userId })
    expect(user.digestOptOut).toBe(true)
  })

  it('is idempotent: the same token used twice keeps the user opted out without error', async () => {
    const userId = await seedUserWithToken('idempotent-unsub@example.com', 'token-idem-456')

    const first = await harness.getRequest().get(`${UNSUBSCRIBE_PATH}?token=token-idem-456`)
    const second = await harness.getRequest().get(`${UNSUBSCRIBE_PATH}?token=token-idem-456`)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.data).toEqual({ unsubscribed: true })

    const fork = em.fork()
    const user = await fork.findOneOrFail(User, { id: userId })
    expect(user.digestOptOut).toBe(true)
  })

  it('does not error-leak on an unknown token and changes no user state', async () => {
    const userId = await seedUserWithToken('untouched-unsub@example.com', 'token-real-789')

    const res = await harness.getRequest().get(`${UNSUBSCRIBE_PATH}?token=token-does-not-exist`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ unsubscribed: true })

    const fork = em.fork()
    const user = await fork.findOneOrFail(User, { id: userId })
    expect(user.digestOptOut).toBe(false)
  })

  it('returns the same generic confirmation for a blank token', async () => {
    const res = await harness.getRequest().get(`${UNSUBSCRIBE_PATH}?token=`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ unsubscribed: true })
  })
})
