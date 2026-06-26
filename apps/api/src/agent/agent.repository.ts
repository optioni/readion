import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { AgentConversation, AgentMessage } from '@readion/db'
import type { AgentConversationMode, AgentMessageContent, AgentMessageRole } from '@readion/shared'

export type CreateConversationInput = {
  userId: string
  mode: AgentConversationMode
  studySessionId?: string | null
  certificationId?: string | null
}

export type AppendMessageInput = {
  userId: string
  conversationId: string
  role: AgentMessageRole
  content: AgentMessageContent
}

export type ConversationWithMessages = {
  conversation: AgentConversation
  messages: AgentMessage[]
}

const MESSAGE_ORDER = { createdAt: 'ASC', id: 'ASC' } as const

@Injectable()
export class AgentConversationRepository {
  constructor(private readonly em: EntityManager) {}

  async createConversation(input: CreateConversationInput): Promise<AgentConversation> {
    const em = this.em.fork()
    const conversation = em.create(AgentConversation, {
      userId: input.userId,
      mode: input.mode,
      studySessionId: input.studySessionId ?? null,
      certificationId: input.certificationId ?? null,
      lastActivityAt: new Date(),
    })
    em.persist(conversation)
    await em.flush()
    return conversation
  }

  async appendMessage(input: AppendMessageInput): Promise<AgentMessage> {
    const em = this.em.fork()
    await this.requireOwned(em, input.userId, input.conversationId)
    const message = em.create(AgentMessage, {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
    })
    em.persist(message)
    await em.flush()
    return message
  }

  async loadMessages(userId: string, conversationId: string): Promise<AgentMessage[]> {
    const em = this.em.fork()
    await this.requireOwned(em, userId, conversationId)
    return em.find(AgentMessage, { conversationId }, { orderBy: MESSAGE_ORDER })
  }

  async getWithMessages(userId: string, conversationId: string): Promise<ConversationWithMessages> {
    const em = this.em.fork()
    const conversation = await this.requireOwned(em, userId, conversationId)
    const messages = await em.find(AgentMessage, { conversationId }, { orderBy: MESSAGE_ORDER })
    return { conversation, messages }
  }

  private async requireOwned(
    em: EntityManager,
    userId: string,
    conversationId: string,
  ): Promise<AgentConversation> {
    const conversation = await em.findOne(AgentConversation, {
      id: conversationId,
      userId,
      deletedAt: null,
    })
    if (conversation === null) {
      throw new NotFoundException('Conversation not found')
    }
    return conversation
  }
}
