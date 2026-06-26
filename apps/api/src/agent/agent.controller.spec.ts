import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type AgentAcceptanceHarness,
  createAgentAcceptanceHarness,
} from './test/agent-acceptance-harness'

type SseEvent = { type?: string; [key: string]: unknown }

function parseSseEvents(raw: string): SseEvent[] {
  return raw
    .split('\n\n')
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .join(''),
    )
    .filter((payload) => payload.length > 0 && payload !== '[DONE]')
    .map((payload) => JSON.parse(payload) as SseEvent)
}

describe('agent controller', () => {
  let harness: AgentAcceptanceHarness

  beforeAll(async () => {
    harness = await createAgentAcceptanceHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('creates an in-session conversation with the resolved certificationId', async () => {
    const cert = await harness.seedCertification('CLF-C02', 'live')
    const chunkId = await harness.seedChunk(cert.id, 'Security')
    const token = await harness.registerAndLogin('ctl-insession@example.com', 'correcthorse')
    const userId = await harness.getUserIdFromToken(token)
    const enrollmentId = await harness.enroll(token, cert.id)
    const { sessionId } = await harness.seedStudySession(enrollmentId, userId, chunkId)

    const res = await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/agent-conversations`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.data.mode).toBe('in_session')
    expect(res.body.data.studySessionId).toBe(sessionId)
    expect(res.body.data.certificationId).toBe(cert.id)
    expect(res.body.relationships.messages.href).toContain(res.body.data.id)
  })

  it('creates a standalone conversation', async () => {
    const token = await harness.registerAndLogin('ctl-standalone@example.com', 'correcthorse')
    const res = await harness
      .getRequest()
      .post('/api/v1/agent-conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.data.mode).toBe('standalone')
    expect(res.body.data.studySessionId).toBeNull()
    expect(res.body.data.certificationId).toBeNull()
  })

  it('streams a standalone turn over SSE', async () => {
    const token = await harness.registerAndLogin('ctl-stream@example.com', 'correcthorse')
    const create = await harness
      .getRequest()
      .post('/api/v1/agent-conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    const conversationId = create.body.data.id as string

    const turn = await harness
      .getRequest()
      .post(`/api/v1/agent-conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'text/event-stream')
      .send({ content: 'Explain TLS in general.' })

    expect(turn.status).toBe(200)
    expect(turn.headers['content-type']).toContain('text/event-stream')
    const events = parseSseEvents(turn.text)
    expect(
      events.filter((e) => typeof e.type === 'string' && e.type.includes('text-delta')).length,
    ).toBeGreaterThan(0)
  })

  it('returns 422 on an empty message body', async () => {
    const token = await harness.registerAndLogin('ctl-422@example.com', 'correcthorse')
    const create = await harness
      .getRequest()
      .post('/api/v1/agent-conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    const conversationId = create.body.data.id as string

    const res = await harness
      .getRequest()
      .post(`/api/v1/agent-conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' })

    expect(res.status).toBe(422)
  })

  it('returns a conversation with ordered messages when include=messages', async () => {
    const token = await harness.registerAndLogin('ctl-get@example.com', 'correcthorse')
    const create = await harness
      .getRequest()
      .post('/api/v1/agent-conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    const conversationId = create.body.data.id as string

    await harness
      .getRequest()
      .post(`/api/v1/agent-conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Explain the OSI model.' })

    const res = await harness
      .getRequest()
      .get(`/api/v1/agent-conversations/${conversationId}?include=messages`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(conversationId)
    const messages = res.body.relationships.messages.data as Array<{ role: string }>
    expect(Array.isArray(messages)).toBe(true)
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0].role).toBe('user')
  })

  it("returns 404 creating a conversation from another user's session", async () => {
    const cert = await harness.seedCertification('CLF-C02', 'live')
    const chunkId = await harness.seedChunk(cert.id, 'Security')
    const owner = await harness.registerAndLogin('ctl-owner@example.com', 'correcthorse')
    const ownerId = await harness.getUserIdFromToken(owner)
    const enrollmentId = await harness.enroll(owner, cert.id)
    const { sessionId } = await harness.seedStudySession(enrollmentId, ownerId, chunkId)

    const other = await harness.registerAndLogin('ctl-other@example.com', 'correcthorse')
    const res = await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/agent-conversations`)
      .set('Authorization', `Bearer ${other}`)
      .send({})

    expect(res.status).toBe(404)
  })

  it("returns 404 reading another user's conversation", async () => {
    const owner = await harness.registerAndLogin('ctl-getowner@example.com', 'correcthorse')
    const create = await harness
      .getRequest()
      .post('/api/v1/agent-conversations')
      .set('Authorization', `Bearer ${owner}`)
      .send({})
    const conversationId = create.body.data.id as string

    const other = await harness.registerAndLogin('ctl-getother@example.com', 'correcthorse')
    const res = await harness
      .getRequest()
      .get(`/api/v1/agent-conversations/${conversationId}`)
      .set('Authorization', `Bearer ${other}`)

    expect(res.status).toBe(404)
  })
})
