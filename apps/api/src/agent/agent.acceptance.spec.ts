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

function eventsOfType(events: SseEvent[], predicate: (type: string) => boolean): SseEvent[] {
  return events.filter((e) => typeof e.type === 'string' && predicate(e.type))
}

describe('agent acceptance', () => {
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

  it('in-session loop: create conversation → stream a tooled turn → persist ordered messages', async () => {
    const cert = await harness.seedCertification('CLF-C02', 'live')
    const chunkId = await harness.seedChunk(cert.id, 'Security')
    await harness.seedChunk(cert.id, 'Networking')

    const token = await harness.registerAndLogin('agent-insession@example.com', 'correcthorse')
    const auth = `Bearer ${token}`
    const userId = await harness.getUserIdFromToken(token)
    const enrollmentId = await harness.enroll(token, cert.id)

    await harness.seedWeakArea(enrollmentId, 'Security', 0.3)
    await harness.seedWeakArea(enrollmentId, 'Networking', 0.7)
    await harness.seedDiagnostic(enrollmentId, userId, 55)

    const { sessionId } = await harness.seedStudySession(enrollmentId, userId, chunkId)

    // Create an in-session conversation scoped to the seeded session.
    const create = await harness
      .getRequest()
      .post(`/api/v1/sessions/${sessionId}/agent-conversations`)
      .set('Authorization', auth)
      .send({})

    expect(create.status).toBe(201)
    expect(create.body.data.mode).toBe('in_session')
    expect(create.body.data.studySessionId).toBe(sessionId)
    expect(create.body.data.certificationId).toBe(cert.id)
    expect(create.body.relationships).toBeDefined()

    const conversationId = create.body.data.id as string

    // POST a message and consume the SSE turn.
    const turn = await harness
      .getRequest()
      .post(`/api/v1/agent-conversations/${conversationId}/messages`)
      .set('Authorization', auth)
      .set('Accept', 'text/event-stream')
      .send({ content: 'Where am I weakest and why?' })

    expect(turn.status).toBe(200)
    expect(turn.headers['content-type']).toContain('text/event-stream')

    const events = parseSseEvents(turn.text)

    // Ordered text-delta events forming the assistant reply.
    const textDeltas = eventsOfType(events, (t) => t.includes('text-delta'))
    expect(textDeltas.length).toBeGreaterThan(0)

    // A tool invocation and its result are streamed for the in-session turn.
    const toolEvents = eventsOfType(events, (t) => t.includes('tool'))
    expect(toolEvents.length).toBeGreaterThan(0)
    const toolResultEvents = eventsOfType(
      events,
      (t) => t.includes('tool-output') || t.includes('tool-result'),
    )
    expect(toolResultEvents.length).toBeGreaterThan(0)

    // Terminal completion event.
    const finishEvents = eventsOfType(events, (t) => t === 'finish' || t.endsWith('finish'))
    expect(finishEvents.length).toBeGreaterThan(0)

    // Messages persisted in turn order: user → tool-call → tool-result → assistant.
    const messages = await harness.getAgentMessages(conversationId)
    const roles = messages.map((m) => m.role)
    expect(roles[0]).toBe('user')
    expect(roles).toContain('assistant')
    expect(roles).toContain('tool')
    expect(roles.indexOf('user')).toBeLessThan(roles.lastIndexOf('assistant'))

    // lastActivityAt refreshed by the turn.
    const conversation = await harness.getConversation(conversationId)
    expect(conversation?.last_activity_at).toBeDefined()
    expect(new Date(conversation!.last_activity_at).getTime()).toBeGreaterThan(0)
  })

  it('standalone loop: create conversation → stream a reply with no cert-scoped tools', async () => {
    const token = await harness.registerAndLogin('agent-standalone@example.com', 'correcthorse')
    const auth = `Bearer ${token}`

    const create = await harness
      .getRequest()
      .post('/api/v1/agent-conversations')
      .set('Authorization', auth)
      .send({})

    expect(create.status).toBe(201)
    expect(create.body.data.mode).toBe('standalone')
    expect(create.body.data.studySessionId).toBeNull()
    expect(create.body.data.certificationId).toBeNull()

    const conversationId = create.body.data.id as string

    const turn = await harness
      .getRequest()
      .post(`/api/v1/agent-conversations/${conversationId}/messages`)
      .set('Authorization', auth)
      .set('Accept', 'text/event-stream')
      .send({ content: 'Explain the OSI model in general.' })

    expect(turn.status).toBe(200)
    expect(turn.headers['content-type']).toContain('text/event-stream')

    const events = parseSseEvents(turn.text)

    const textDeltas = eventsOfType(events, (t) => t.includes('text-delta'))
    expect(textDeltas.length).toBeGreaterThan(0)

    // No cert-scoped tool events for a standalone turn.
    const toolEvents = eventsOfType(events, (t) => t.includes('tool'))
    expect(toolEvents).toHaveLength(0)

    const messages = await harness.getAgentMessages(conversationId)
    const roles = messages.map((m) => m.role)
    expect(roles).toContain('user')
    expect(roles).toContain('assistant')
    expect(roles).not.toContain('tool')
  })

  it("posting a message to another user's conversation returns 404", async () => {
    const owner = await harness.registerAndLogin('agent-owner@example.com', 'correcthorse')
    const create = await harness
      .getRequest()
      .post('/api/v1/agent-conversations')
      .set('Authorization', `Bearer ${owner}`)
      .send({})
    expect(create.status).toBe(201)
    const conversationId = create.body.data.id as string

    const other = await harness.registerAndLogin('agent-other@example.com', 'correcthorse')
    const res = await harness
      .getRequest()
      .post(`/api/v1/agent-conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${other}`)
      .send({ content: 'hello' })

    expect(res.status).toBe(404)
  })
})
