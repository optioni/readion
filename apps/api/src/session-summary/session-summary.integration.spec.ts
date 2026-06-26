import { EntityManager } from '@mikro-orm/core'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  SESSION_SUMMARY_CORRECT_ANSWER,
  SESSION_SUMMARY_WRONG_ANSWER,
  createSessionSummaryAcceptanceHarness,
  type SessionSummaryAcceptanceHarness,
} from './test/session-summary-acceptance-harness'

type SessionItemPayload = { index: number; type: string; content: string; completed: boolean }
type QuizContent = { questionId: string; question: string; options: string[]; format: string }

async function answerSessionAndEnd(
  harness: SessionSummaryAcceptanceHarness,
  auth: string,
  enrollmentId: string,
): Promise<string> {
  const create = await harness
    .getRequest()
    .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
    .set('Authorization', auth)
    .send({ durationMinutes: 30, contentMix: 'quiz-heavy', difficulty: 'intermediate' })
  const sessionId = create.body.data.id as string

  const getItems = await harness
    .getRequest()
    .get(`/api/v1/sessions/${sessionId}?include=items`)
    .set('Authorization', auth)
  const items = getItems.body.data.items as SessionItemPayload[]
  const quizItems = items.filter((i) => i.type === 'quiz')

  for (let i = 0; i < quizItems.length; i++) {
    const parsed = JSON.parse(quizItems[i]!.content) as QuizContent
    const isCorrect = i % 2 === 0
    await harness
      .getRequest()
      .post(`/api/v1/quiz/${parsed.questionId}/submit`)
      .set('Authorization', auth)
      .send({
        userCertificationId: enrollmentId,
        answer: isCorrect ? SESSION_SUMMARY_CORRECT_ANSWER : SESSION_SUMMARY_WRONG_ANSWER,
        confidence: isCorrect ? 4 : 1,
        timeTakenMs: 1500,
      })
  }

  for (const item of items) {
    await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/items/${item.index}/complete`)
      .set('Authorization', auth)
  }

  await harness.getRequest().post(`/api/v1/sessions/${sessionId}/end`).set('Authorization', auth)

  return sessionId
}

describe('session summary integration (groups 7-9)', () => {
  let harness: SessionSummaryAcceptanceHarness

  beforeAll(async () => {
    harness = await createSessionSummaryAcceptanceHarness()
  }, 180_000)

  beforeEach(async () => {
    await harness.resetState()
  }, 60_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  it('produces an identical summary twice and mutates no stored weak-area state (read-only)', async () => {
    const cert = await harness.seedCertification('SUM-IDEMP-01')
    for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
      await harness.seedChunk(cert.id, domain)
    }

    const token = await harness.registerAndLogin('sum-idemp-01@example.com', 'correcthorse')
    const auth = `Bearer ${token}`
    const enrollmentId = await harness.enroll(token, cert.id)

    const sessionId = await answerSessionAndEnd(harness, auth, enrollmentId)

    const em = harness.moduleRef.get(EntityManager)
    const conn = em.fork().getConnection()
    const countWeakAreas = async (): Promise<number> => {
      const rows = await conn.execute<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM weak_areas WHERE user_certification_id = ?',
        [enrollmentId],
      )
      return Number.parseInt(rows[0]!.count, 10)
    }

    const before = await countWeakAreas()

    const first = await harness
      .getRequest()
      .get(`/api/v1/sessions/${sessionId}/summary`)
      .set('Authorization', auth)
    expect(first.status).toBe(200)

    const second = await harness
      .getRequest()
      .get(`/api/v1/sessions/${sessionId}/summary`)
      .set('Authorization', auth)
    expect(second.status).toBe(200)

    expect(second.body.data).toEqual(first.body.data)
    expect(first.body.data.questionsAnswered).toBeGreaterThan(0)

    const after = await countWeakAreas()
    expect(after).toBe(before)
  })

  it('returns 404 for all four endpoints when the resource belongs to another user', async () => {
    const cert = await harness.seedCertification('SUM-XUSER-01')
    await harness.seedChunk(cert.id, 'Security')

    const ownerToken = await harness.registerAndLogin('sum-owner-01@example.com', 'correcthorse')
    const ownerAuth = `Bearer ${ownerToken}`
    const enrollmentId = await harness.enroll(ownerToken, cert.id)

    const sessionCreate = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/sessions`)
      .set('Authorization', ownerAuth)
      .send({ durationMinutes: 30, contentMix: 'balanced', difficulty: 'intermediate' })
    const sessionId = sessionCreate.body.data.id as string

    const mockCreate = await harness
      .getRequest()
      .post(`/api/v1/user-certifications/${enrollmentId}/mock-exams`)
      .set('Authorization', ownerAuth)
    const mockId = mockCreate.body.data.id as string

    const otherToken = await harness.registerAndLogin('sum-other-01@example.com', 'correcthorse')
    const otherAuth = `Bearer ${otherToken}`

    const sessionSummary = await harness
      .getRequest()
      .get(`/api/v1/sessions/${sessionId}/summary`)
      .set('Authorization', otherAuth)
    expect(sessionSummary.status).toBe(404)

    const sessionDrill = await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/drill`)
      .set('Authorization', otherAuth)
    expect(sessionDrill.status).toBe(404)

    const mockSummary = await harness
      .getRequest()
      .get(`/api/v1/mock-exams/${mockId}/summary`)
      .set('Authorization', otherAuth)
    expect(mockSummary.status).toBe(404)

    const mockDrill = await harness
      .getRequest()
      .post(`/api/v1/mock-exams/${mockId}/drill`)
      .set('Authorization', otherAuth)
    expect(mockDrill.status).toBe(404)
  })
})
