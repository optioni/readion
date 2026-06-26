import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AgentConversation, AgentMessage, Certification, StudySession } from '@readion/db'
import type { ModelMessage } from 'ai'
import { stepCountIs } from 'ai'
import type { Queue } from 'bullmq'
import { QueueEvents } from 'bullmq'
import type { EnvConfig } from '../config/env.schema'
import { LlmService } from '../llm/llm.service'
import { ReadinessService } from '../readiness/readiness.service'
import { WeakAreasService } from '../weak-areas/weak-areas.service'
import { AgentConversationRepository } from './agent.repository'
import {
  type AgentMessageRowData,
  buildReplayMessages,
  serializeModelMessage,
} from './agent-message.serializer'
import { buildSystemPrompt, type SystemPromptInput } from './system-prompt.builder'
import { AGENT_MATERIAL_QUEUE_NAME } from './tools/agent-tools.config'
import { AgentToolsFactory } from './tools/agent-tools.factory'
import { AGENT_MATERIAL_QUEUE } from './tools/agent-tools.types'

export type SseEvent = { type: string; [key: string]: unknown }

export type RunTurnInput = {
  userId: string
  conversationId: string
  content: string
}

const AGENT_MAX_STEPS = 8
const MATERIAL_JOB_TIMEOUT_MS = 120_000

type TurnPlan = {
  systemMessages: ModelMessage[]
  tools: ReturnType<AgentToolsFactory['buildInSessionTools']>
}

@Injectable()
export class AgentService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly conversations: AgentConversationRepository,
    private readonly toolsFactory: AgentToolsFactory,
    private readonly llm: LlmService,
    private readonly weakAreas: WeakAreasService,
    private readonly readiness: ReadinessService,
    @Inject(AGENT_MATERIAL_QUEUE) private readonly materialQueue: Queue,
  ) {}

  async createInSessionConversation(userId: string, sessionId: string): Promise<AgentConversation> {
    const em = this.em.fork()
    const session = await em.findOne(
      StudySession,
      { id: sessionId, user: userId },
      { populate: ['userCertification.certification'] },
    )
    if (session === null) {
      throw new NotFoundException('Session not found')
    }
    return this.conversations.createConversation({
      userId,
      mode: 'in_session',
      studySessionId: sessionId,
      certificationId: session.userCertification.certification.id,
    })
  }

  async createStandaloneConversation(userId: string): Promise<AgentConversation> {
    return this.conversations.createConversation({ userId, mode: 'standalone' })
  }

  async getConversation(
    userId: string,
    conversationId: string,
    includeMessages: boolean,
  ): Promise<{ conversation: AgentConversation; messages: AgentMessage[] }> {
    if (includeMessages) {
      return this.conversations.getWithMessages(userId, conversationId)
    }
    const { conversation } = await this.conversations.getWithMessages(userId, conversationId)
    return { conversation, messages: [] }
  }

  async *runTurn(input: RunTurnInput): AsyncGenerator<SseEvent> {
    const { conversation, messages } = await this.conversations.getWithMessages(
      input.userId,
      input.conversationId,
    )

    const replay = buildReplayMessages(
      messages.map((row): AgentMessageRowData => ({ role: row.role, content: row.content })),
    )

    await this.conversations.appendMessage({
      userId: input.userId,
      conversationId: input.conversationId,
      role: 'user',
      content: input.content,
    })
    const userMessage: ModelMessage = { role: 'user', content: input.content }

    const plan = await this.planTurn(conversation, input.userId)
    const turnMessages: ModelMessage[] = [...plan.systemMessages, ...replay, userMessage]

    let result: Awaited<ReturnType<LlmService['streamText']>>
    try {
      result = await this.llm.streamText({
        taskType: 'agent-qa',
        messages: turnMessages,
        tools: plan.tools,
        stopWhen: stepCountIs(AGENT_MAX_STEPS),
      })
    } catch (error) {
      yield this.errorEvent(error)
      throw error
    }

    const pendingJobIds: string[] = []
    let streamError: unknown
    try {
      for await (const part of result.fullStream) {
        if (part.type === 'error') {
          streamError = part.error
          break
        }
        yield part as SseEvent
        if (part.type === 'tool-result') {
          const jobId = enqueuedJobId(part)
          if (jobId !== null) {
            pendingJobIds.push(jobId)
          }
        }
      }
    } catch (error) {
      yield this.errorEvent(error)
      throw error
    }

    if (streamError !== undefined) {
      yield this.errorEvent(streamError)
      throw streamError instanceof Error ? streamError : new Error(String(streamError))
    }

    const response = await result.response
    await this.persistResponseMessages(input, response.messages)
    await this.touchLastActivity(conversation.id)

    for (const jobId of pendingJobIds) {
      yield await this.waitForMaterialJob(jobId)
    }
  }

  async waitForMaterialJob(jobId: string, options: { timeoutMs?: number } = {}): Promise<SseEvent> {
    const timeoutMs = options.timeoutMs ?? MATERIAL_JOB_TIMEOUT_MS
    const queueEvents = new QueueEvents(AGENT_MATERIAL_QUEUE_NAME, {
      connection: this.materialQueue.opts.connection,
    })
    await queueEvents.waitUntilReady()

    try {
      const status = await new Promise<'completed' | 'failed' | 'timeout'>((resolve) => {
        const timer = setTimeout(() => resolve('timeout'), timeoutMs)
        const settle = (outcome: 'completed' | 'failed') => {
          clearTimeout(timer)
          resolve(outcome)
        }
        queueEvents.on('completed', ({ jobId: id }) => {
          if (id === jobId) settle('completed')
        })
        queueEvents.on('failed', ({ jobId: id }) => {
          if (id === jobId) settle('failed')
        })
        // Subscription only delivers future events, so reconcile against the
        // job's current state in case it finished before we were listening.
        void this.materialQueue.getJob(jobId).then(async (job) => {
          const state = await job?.getState()
          if (state === 'completed' || state === 'failed') settle(state)
        })
      })
      return { type: 'job-event', jobId, status }
    } finally {
      await queueEvents.close()
    }
  }

  private async planTurn(conversation: AgentConversation, userId: string): Promise<TurnPlan> {
    if (conversation.mode === 'standalone') {
      return {
        systemMessages: buildSystemPrompt({ mode: 'standalone' }, this.providerName()),
        tools: this.toolsFactory.buildStandaloneTools(),
      }
    }

    const sessionId = requireValue(conversation.studySessionId, 'study session')
    const certificationId = requireValue(conversation.certificationId, 'certification')

    const em = this.em.fork()
    const session = await em.findOneOrFail(
      StudySession,
      { id: sessionId, user: userId },
      { populate: ['userCertification'] },
    )
    const enrollmentId = session.userCertification.id
    const certification = await em.findOneOrFail(Certification, { id: certificationId })

    const weakAreas = await this.weakAreas.listForEnrollment(userId, enrollmentId)
    const readiness = await this.readiness.readForOwner(userId, enrollmentId)

    const promptInput: SystemPromptInput = {
      mode: 'in_session',
      certification: {
        name: certification.name,
        provider: certification.provider,
        code: certification.code,
        domains: certification.domains,
        questionCount: certification.questionCount,
        passingScore: certification.passingScore,
        timeLimitMinutes: certification.timeLimitMinutes,
      },
      weakAreas: weakAreas.map((area) => ({
        domain: area.domain,
        score: area.score,
        accuracy: area.accuracy,
        meanConfidence: area.meanConfidence,
        responseCount: area.responseCount,
      })),
      readiness: { calibrated: readiness.calibrated, score: readiness.score },
      sessionFocus: session.focusArea,
    }

    return {
      systemMessages: buildSystemPrompt(promptInput, this.providerName()),
      tools: this.toolsFactory.buildInSessionTools({
        userId,
        sessionId,
        certificationId,
        enrollmentId,
      }),
    }
  }

  private async persistResponseMessages(
    input: RunTurnInput,
    responseMessages: ModelMessage[],
  ): Promise<void> {
    for (const message of responseMessages) {
      const serialized = serializeModelMessage(message)
      await this.conversations.appendMessage({
        userId: input.userId,
        conversationId: input.conversationId,
        role: serialized.role,
        content: serialized.content,
      })
    }
  }

  private async touchLastActivity(conversationId: string): Promise<void> {
    const em = this.em.fork()
    const conversation = await em.findOneOrFail(AgentConversation, { id: conversationId })
    conversation.lastActivityAt = new Date()
    await em.flush()
  }

  private providerName(): string {
    return this.config.get('AI_PROVIDER', { infer: true })
  }

  private errorEvent(error: unknown): SseEvent {
    return { type: 'error', error: error instanceof Error ? error.message : String(error) }
  }
}

function requireValue<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`In-session conversation is missing its ${label}`)
  }
  return value
}

function enqueuedJobId(part: { output?: unknown }): string | null {
  const output = part.output
  if (
    output !== null &&
    typeof output === 'object' &&
    'status' in output &&
    (output as { status?: unknown }).status === 'enqueued' &&
    'jobId' in output
  ) {
    return String((output as { jobId: unknown }).jobId)
  }
  return null
}
