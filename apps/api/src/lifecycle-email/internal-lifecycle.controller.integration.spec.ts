import { EntityManager } from '@mikro-orm/core'
import { UserCertification } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from '../openapi/openapi.factory'
import {
  createLifecycleEmailAcceptanceHarness,
  INTERNAL_API_SECRET,
  type LifecycleEmailAcceptanceHarness,
} from './test/lifecycle-email-acceptance-harness'

// The worker (group 5) sends the shared secret on this header; the API guard reads the
// same literal. The API package cannot import from the worker package.
const INTERNAL_API_SECRET_HEADER = 'x-internal-api-secret'
const DIGEST_ENDPOINT = '/internal/lifecycle/digest'
const NUDGE_ENDPOINT = '/internal/lifecycle/nudge'

describe('Internal lifecycle trigger endpoints (integration)', () => {
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

  const req = () => harness.getRequest()

  async function seedCalibratedEnrollment(email: string): Promise<{
    userId: string
    enrollmentId: string
  }> {
    const token = await harness.registerAndLogin(email, 'correcthorse')
    const userId = await harness.getUserIdFromToken(token)
    await harness.verifyUserEmail(userId)

    const cert = await harness.seedCertification(`CLF-${Math.random().toString(36).slice(2, 8)}`)
    const enrollmentId = await harness.enroll(token, cert.id)
    const cloudChunk = await harness.seedChunk(cert.id, 'Cloud Concepts')
    const securityChunk = await harness.seedChunk(cert.id, 'Security')

    for (let i = 0; i < 8; i += 1) {
      await harness.seedQuizResponse(enrollmentId, cloudChunk, true, 4)
    }
    for (let i = 0; i < 8; i += 1) {
      await harness.seedQuizResponse(enrollmentId, securityChunk, false, 2)
    }
    await harness.seedSubmittedDiagnostic(enrollmentId, userId, 60)
    await harness.seedDueReviewItem(enrollmentId, securityChunk, new Date(Date.now() - 86_400_000))

    return { userId, enrollmentId }
  }

  function digestsFor(email: string) {
    return harness
      .capturedMail()
      .filter((m) => m.to === email && m.subject.toLowerCase().includes('progress'))
  }

  describe('POST /internal/lifecycle/digest', () => {
    it('assembles and sends a digest for each eligible user with a valid secret', async () => {
      const email = 'internal-digest@example.com'
      const { userId, enrollmentId } = await seedCalibratedEnrollment(email)

      const res = await req()
        .post(DIGEST_ENDPOINT)
        .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
        .send({ userIds: [userId] })

      expect(res.status).toBeLessThan(300)
      expect(digestsFor(email)).toHaveLength(1)

      const fork = em.fork()
      const enrollment = await fork.findOneOrFail(UserCertification, { id: enrollmentId })
      expect(enrollment.lastDigestReadiness).not.toBeNull()
    })

    it('rejects a wrong secret and performs no send', async () => {
      const email = 'internal-digest-wrong@example.com'
      const { userId } = await seedCalibratedEnrollment(email)

      const res = await req()
        .post(DIGEST_ENDPOINT)
        .set(INTERNAL_API_SECRET_HEADER, 'not-the-secret')
        .send({ userIds: [userId] })

      expect([401, 403]).toContain(res.status)
      expect(digestsFor(email)).toHaveLength(0)
    })

    it('rejects a missing secret and performs no send', async () => {
      const email = 'internal-digest-missing@example.com'
      const { userId } = await seedCalibratedEnrollment(email)

      const res = await req()
        .post(DIGEST_ENDPOINT)
        .send({ userIds: [userId] })

      expect([401, 403]).toContain(res.status)
      expect(digestsFor(email)).toHaveLength(0)
    })
  })

  describe('POST /internal/lifecycle/nudge', () => {
    it('accepts a valid secret', async () => {
      const { userId } = await seedCalibratedEnrollment('internal-nudge@example.com')

      const res = await req()
        .post(NUDGE_ENDPOINT)
        .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
        .send({ userIds: [userId] })

      expect(res.status).toBeLessThan(300)
    })

    it('rejects a wrong secret', async () => {
      const { userId } = await seedCalibratedEnrollment('internal-nudge-wrong@example.com')

      const res = await req()
        .post(NUDGE_ENDPOINT)
        .set(INTERNAL_API_SECRET_HEADER, 'not-the-secret')
        .send({ userIds: [userId] })

      expect([401, 403]).toContain(res.status)
    })

    it('rejects a missing secret', async () => {
      const { userId } = await seedCalibratedEnrollment('internal-nudge-missing@example.com')

      const res = await req()
        .post(NUDGE_ENDPOINT)
        .send({ userIds: [userId] })

      expect([401, 403]).toContain(res.status)
    })
  })

  describe('public OpenAPI document', () => {
    it('does not expose the internal lifecycle endpoints', () => {
      const document = buildOpenApiDocument(harness.app)
      const paths = Object.keys(document.paths)
      expect(paths.some((path) => path.includes('/internal'))).toBe(false)
    })
  })
})
