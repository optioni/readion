import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDbHarness, type DbHarness } from '../test-helpers/db-harness'
import { AgentConversation } from './agent-conversation.entity'
import { AgentMessage } from './agent-message.entity'

describe('AgentConversation and AgentMessage entities', () => {
  let harness: DbHarness

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  async function seedUser(email: string): Promise<string> {
    const conn = harness.getEm().getConnection()
    const result = await conn.execute<{ id: string }[]>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, 'hash', 'user', now(), now())
       RETURNING id`,
      [email],
    )
    return result[0]!.id
  }

  it('persists and round-trips an in-session AgentConversation', async () => {
    const userId = await seedUser('in-session@example.com')
    const studySessionId = crypto.randomUUID()
    const certificationId = crypto.randomUUID()
    const lastActivityAt = new Date()

    const em = harness.getEm()
    const conversation = em.create(AgentConversation, {
      userId,
      studySessionId,
      certificationId,
      mode: 'in_session',
      lastActivityAt,
      deletedAt: null,
    })
    em.persist(conversation)
    await em.flush()

    const em2 = harness.getEm()
    const loaded = await em2.findOne(AgentConversation, { id: conversation.id })
    expect(loaded).not.toBeNull()
    expect(loaded!.userId).toBe(userId)
    expect(loaded!.studySessionId).toBe(studySessionId)
    expect(loaded!.certificationId).toBe(certificationId)
    expect(loaded!.mode).toBe('in_session')
    expect(loaded!.lastActivityAt.getTime()).toBe(lastActivityAt.getTime())
    expect(loaded!.deletedAt).toBeNull()
  })

  it('persists and round-trips a standalone AgentConversation with no cert context', async () => {
    const userId = await seedUser('standalone@example.com')
    const lastActivityAt = new Date()

    const em = harness.getEm()
    const conversation = em.create(AgentConversation, {
      userId,
      studySessionId: null,
      certificationId: null,
      mode: 'standalone',
      lastActivityAt,
      deletedAt: null,
    })
    em.persist(conversation)
    await em.flush()

    const em2 = harness.getEm()
    const loaded = await em2.findOne(AgentConversation, { id: conversation.id })
    expect(loaded).not.toBeNull()
    expect(loaded!.mode).toBe('standalone')
    expect(loaded!.studySessionId).toBeNull()
    expect(loaded!.certificationId).toBeNull()
  })

  it('soft-deletes a conversation via the deletedAt marker', async () => {
    const userId = await seedUser('soft-delete@example.com')

    const em = harness.getEm()
    const conversation = em.create(AgentConversation, {
      userId,
      studySessionId: null,
      certificationId: null,
      mode: 'standalone',
      lastActivityAt: new Date(),
      deletedAt: null,
    })
    em.persist(conversation)
    await em.flush()

    const deletedAt = new Date()
    conversation.deletedAt = deletedAt
    await em.flush()

    const em2 = harness.getEm()
    const loaded = await em2.findOne(AgentConversation, { id: conversation.id })
    expect(loaded!.deletedAt).not.toBeNull()
    expect(loaded!.deletedAt!.getTime()).toBe(deletedAt.getTime())
  })

  it('persists ordered AgentMessage rows mirroring CoreMessage content', async () => {
    const userId = await seedUser('messages@example.com')

    const em = harness.getEm()
    const conversation = em.create(AgentConversation, {
      userId,
      studySessionId: crypto.randomUUID(),
      certificationId: crypto.randomUUID(),
      mode: 'in_session',
      lastActivityAt: new Date(),
      deletedAt: null,
    })
    em.persist(conversation)
    await em.flush()

    const base = Date.now()
    const userMessage = em.create(AgentMessage, {
      conversationId: conversation.id,
      role: 'user',
      content: 'Where am I weakest and why?',
      createdAt: new Date(base),
    })
    const toolCallMessage = em.create(AgentMessage, {
      conversationId: conversation.id,
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'getUserProgress', args: {} }],
      createdAt: new Date(base + 1),
    })
    const toolResultMessage = em.create(AgentMessage, {
      conversationId: conversation.id,
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'getUserProgress',
          result: { readiness: 0.42 },
        },
      ],
      createdAt: new Date(base + 2),
    })
    const assistantMessage = em.create(AgentMessage, {
      conversationId: conversation.id,
      role: 'assistant',
      content: 'You are weakest in networking.',
      createdAt: new Date(base + 3),
    })
    em.persist([userMessage, toolCallMessage, toolResultMessage, assistantMessage])
    await em.flush()

    const em2 = harness.getEm()
    const loaded = await em2.find(
      AgentMessage,
      { conversationId: conversation.id },
      { orderBy: { createdAt: 'asc', id: 'asc' } },
    )
    expect(loaded.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expect(loaded[0]!.content).toBe('Where am I weakest and why?')
    expect(loaded[1]!.content).toEqual([
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'getUserProgress', args: {} },
    ])
    expect(loaded[2]!.content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'getUserProgress',
        result: { readiness: 0.42 },
      },
    ])
    expect(loaded[3]!.content).toBe('You are weakest in networking.')
  })
})
