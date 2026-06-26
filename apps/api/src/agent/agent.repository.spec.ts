import { NotFoundException } from '@nestjs/common'
import { createDbHarness, type DbHarness } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AgentConversationRepository } from './agent.repository'

async function seedUser(harness: DbHarness, email: string): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'hash', 'user', now(), now())
     RETURNING id`,
    [email],
  )
  return rows[0]!.id
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('AgentConversationRepository', () => {
  let harness: DbHarness | undefined

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness?.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  function repo(): AgentConversationRepository {
    if (!harness) throw new Error('DB harness was not initialized')
    return new AgentConversationRepository(harness.getEm())
  }

  it('creates a standalone conversation with lastActivityAt set to now', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'standalone@example.com')

    const before = Date.now()
    const conversation = await repo().createConversation({ userId, mode: 'standalone' })

    expect(conversation.id).toBeDefined()
    expect(conversation.userId).toBe(userId)
    expect(conversation.mode).toBe('standalone')
    expect(conversation.studySessionId).toBeNull()
    expect(conversation.certificationId).toBeNull()
    expect(conversation.lastActivityAt).toBeInstanceOf(Date)
    expect(conversation.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before)

    const persisted = await harness
      .getEm()
      .getConnection()
      .execute<{ last_activity_at: string }[]>(
        `SELECT last_activity_at FROM agent_conversations WHERE id = ?`,
        [conversation.id],
      )
    expect(persisted).toHaveLength(1)
  })

  it('creates an in-session conversation linked to a session and certification', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'insession@example.com')
    const studySessionId = '00000000-0000-4000-8000-0000000000aa'
    const certificationId = '00000000-0000-4000-8000-0000000000bb'

    const conversation = await repo().createConversation({
      userId,
      mode: 'in_session',
      studySessionId,
      certificationId,
    })

    expect(conversation.mode).toBe('in_session')
    expect(conversation.studySessionId).toBe(studySessionId)
    expect(conversation.certificationId).toBe(certificationId)
  })

  it('appends messages and loads them in turn order', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'turns@example.com')
    const conversation = await repo().createConversation({ userId, mode: 'standalone' })

    await repo().appendMessage({
      userId,
      conversationId: conversation.id,
      role: 'user',
      content: 'First question',
    })
    await delay(5)
    await repo().appendMessage({
      userId,
      conversationId: conversation.id,
      role: 'assistant',
      content: [{ type: 'text', text: 'First answer' }],
    })
    await delay(5)
    await repo().appendMessage({
      userId,
      conversationId: conversation.id,
      role: 'user',
      content: 'Second question',
    })

    const messages = await repo().loadMessages(userId, conversation.id)

    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(messages[0]!.content).toBe('First question')
    expect(messages[1]!.content).toEqual([{ type: 'text', text: 'First answer' }])
    expect(messages[2]!.content).toBe('Second question')
  })

  it('gets a conversation with its ordered messages for the owner', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'getowner@example.com')
    const conversation = await repo().createConversation({ userId, mode: 'standalone' })
    await repo().appendMessage({
      userId,
      conversationId: conversation.id,
      role: 'user',
      content: 'Hello',
    })

    const result = await repo().getWithMessages(userId, conversation.id)

    expect(result.conversation.id).toBe(conversation.id)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.content).toBe('Hello')
  })

  it('does not return another user’s conversation (cross-user is not found)', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const ownerId = await seedUser(harness, 'owner@example.com')
    const otherId = await seedUser(harness, 'other@example.com')
    const conversation = await repo().createConversation({ userId: ownerId, mode: 'standalone' })

    await expect(repo().getWithMessages(otherId, conversation.id)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(repo().loadMessages(otherId, conversation.id)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('does not append a message to another user’s conversation', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const ownerId = await seedUser(harness, 'append-owner@example.com')
    const otherId = await seedUser(harness, 'append-other@example.com')
    const conversation = await repo().createConversation({ userId: ownerId, mode: 'standalone' })

    await expect(
      repo().appendMessage({
        userId: otherId,
        conversationId: conversation.id,
        role: 'user',
        content: 'Intruder',
      }),
    ).rejects.toBeInstanceOf(NotFoundException)

    const messages = await repo().loadMessages(ownerId, conversation.id)
    expect(messages).toHaveLength(0)
  })
})
