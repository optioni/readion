import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { ModelMessage, ToolSet } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { AGENT_MATERIAL_JOB_NAME, AGENT_MATERIAL_JOB_PRIORITY } from './agent-tools.config'
import {
  AGENT_EMBEDDING_PORT,
  AGENT_MATERIAL_GENERATION_PORT,
  AGENT_MATERIAL_QUEUE,
  AGENT_PROVENANCE_PORT,
  AGENT_READINESS_PORT,
  AGENT_RETRIEVAL_PORT,
  AGENT_SESSION_HISTORY_PORT,
  AGENT_TOOLS_CONFIG,
  AGENT_WEAK_AREAS_PORT,
  type AgentToolsConfig,
  type ChunkCitation,
  type DomainAccuracyTrend,
  type EmbeddingPort,
  type ExamStrategyPayload,
  type ExplainAnswerPayload,
  type FetchMoreMaterialPayload,
  type InSessionToolContext,
  type MaterialGenerationPort,
  type MaterialIngestionQueue,
  type ProvenancePort,
  type ReadinessPort,
  type RetrievalPort,
  type SemanticSearchPayload,
  type SessionHistoryPayload,
  type SessionHistoryPort,
  type UserProgressPayload,
  type WeakAreasPort,
} from './agent-tools.types'

const SESSION_HISTORY_LIMIT = 10

@Injectable()
export class AgentToolsFactory {
  constructor(
    @Inject(AGENT_EMBEDDING_PORT) private readonly embedding: EmbeddingPort,
    @Inject(AGENT_MATERIAL_GENERATION_PORT) private readonly llm: MaterialGenerationPort,
    @Inject(AGENT_RETRIEVAL_PORT) private readonly retrieval: RetrievalPort,
    @Inject(AGENT_PROVENANCE_PORT) private readonly provenance: ProvenancePort,
    @Inject(AGENT_WEAK_AREAS_PORT) private readonly weakAreas: WeakAreasPort,
    @Inject(AGENT_READINESS_PORT) private readonly readiness: ReadinessPort,
    @Inject(AGENT_SESSION_HISTORY_PORT) private readonly history: SessionHistoryPort,
    @Inject(AGENT_MATERIAL_QUEUE) private readonly queue: MaterialIngestionQueue,
    @Inject(AGENT_TOOLS_CONFIG) private readonly config: AgentToolsConfig,
  ) {}

  buildStandaloneTools(): ToolSet {
    return {}
  }

  buildInSessionTools(ctx: InSessionToolContext): ToolSet {
    return {
      semanticSearch: tool({
        description:
          'Search the certification knowledge base for chunks relevant to a query. Internal grounding only.',
        inputSchema: z.object({ query: z.string() }),
        execute: (input) => this.runSemanticSearch(ctx, input),
      }),
      fetchMoreMaterial: tool({
        description:
          'Expand coverage on a topic: generate inline from existing chunks, or enqueue ingestion when coverage is thin.',
        inputSchema: z.object({ topic: z.string() }),
        execute: (input) => this.runFetchMoreMaterial(ctx, input),
      }),
      explainAnswer: tool({
        description:
          "Explain a quiz answer for one of the user's own session items, grounded in its stored provenance.",
        inputSchema: z.object({ itemIndex: z.number().int() }),
        execute: (input) => this.runExplainAnswer(ctx, input),
      }),
      examStrategy: tool({
        description: 'Return a structured exam-strategy tip for a domain or question type.',
        inputSchema: z.object({ domain: z.string(), questionType: z.string().optional() }),
        execute: (input) => this.runExamStrategy(ctx, input),
      }),
      getUserProgress: tool({
        description: 'Return the user current readiness score and ranked per-domain weak areas.',
        inputSchema: z.object({}),
        execute: () => this.runGetUserProgress(ctx),
      }),
      getSessionHistory: tool({
        description:
          'Return recent study-session (and mock-exam) history with per-domain accuracy trends.',
        inputSchema: z.object({}),
        execute: () => this.runGetSessionHistory(ctx),
      }),
    }
  }

  async runSemanticSearch(
    ctx: InSessionToolContext,
    input: { query: string },
  ): Promise<SemanticSearchPayload> {
    const embedding = await this.embedding.embed(input.query)
    const chunks = await this.retrieval.searchChunks(ctx.certificationId, embedding, {
      threshold: this.config.similarityThreshold,
      limit: this.config.semanticSearchLimit,
    })
    return { tool: 'semanticSearch', internal: true, chunks }
  }

  async runFetchMoreMaterial(
    ctx: InSessionToolContext,
    input: { topic: string },
  ): Promise<FetchMoreMaterialPayload> {
    const embedding = await this.embedding.embed(input.topic)
    const chunks = await this.retrieval.searchChunks(ctx.certificationId, embedding, {
      threshold: this.config.similarityThreshold,
      limit: this.config.semanticSearchLimit,
    })

    if (chunks.length > 0) {
      const sources = chunks.map((chunk) => chunk.text).join('\n\n')
      const result = await this.llm.generateText({
        taskType: 'material-generation',
        system: this.config.abstentionGuidance,
        messages: [
          {
            role: 'user',
            content: `Expand on "${input.topic}" using only the following source material:\n\n${sources}`,
          },
        ],
      })
      return { tool: 'fetchMoreMaterial', status: 'inline', content: result.text }
    }

    const job = await this.queue.add(
      AGENT_MATERIAL_JOB_NAME,
      {
        certificationId: ctx.certificationId,
        topic: input.topic,
        requestedByUserId: ctx.userId,
        sessionId: ctx.sessionId,
      },
      { priority: AGENT_MATERIAL_JOB_PRIORITY },
    )
    return { tool: 'fetchMoreMaterial', status: 'enqueued', jobId: String(job.id) }
  }

  async runExplainAnswer(
    ctx: InSessionToolContext,
    input: { itemIndex: number },
  ): Promise<ExplainAnswerPayload> {
    const provenance = await this.provenance.findOwnedProvenance(
      ctx.userId,
      ctx.sessionId,
      input.itemIndex,
    )
    if (provenance === null) {
      throw new NotFoundException('Session item not found')
    }

    const chunks = await this.retrieval.getChunksByIds(
      ctx.certificationId,
      provenance.sourceChunkIds,
    )
    const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]))
    const citations: ChunkCitation[] = provenance.sourceChunkIds.map((chunkId) => {
      const chunk = chunkById.get(chunkId)
      return {
        chunkId,
        sourceUrl: chunk?.sourceUrl ?? '',
        primaryDomain: chunk?.primaryDomain ?? '',
      }
    })

    const spans = provenance.supportingSpans.join('\n')
    const result = await this.llm.generateText({
      taskType: 'agent-qa',
      system: this.config.abstentionGuidance,
      messages: [
        {
          role: 'user',
          content: `Explain the correct answer for this quiz item using only the supporting evidence below.\n\nQuiz item: ${provenance.content}\n\nSupporting evidence:\n${spans}`,
        },
      ],
    })

    return {
      tool: 'explainAnswer',
      explanation: result.text,
      supportingSpans: provenance.supportingSpans,
      citations,
    }
  }

  async runExamStrategy(
    _ctx: InSessionToolContext,
    input: { domain: string; questionType?: string },
  ): Promise<ExamStrategyPayload> {
    const questionType = input.questionType ?? null
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: questionType
          ? `Give concise exam strategy for ${questionType} questions in the "${input.domain}" domain.`
          : `Give concise exam strategy for the "${input.domain}" domain.`,
      },
    ]
    const result = await this.llm.generateText({ taskType: 'agent-qa', messages })
    return { tool: 'examStrategy', domain: input.domain, questionType, advice: result.text }
  }

  async runGetUserProgress(ctx: InSessionToolContext): Promise<UserProgressPayload> {
    const readiness = await this.readiness.readForOwner(ctx.userId, ctx.enrollmentId)
    const weakAreas = await this.weakAreas.listForEnrollment(ctx.userId, ctx.enrollmentId)
    return {
      tool: 'getUserProgress',
      readiness: { calibrated: readiness.calibrated, score: readiness.score },
      domains: weakAreas.map((area) => ({
        domain: area.domain,
        score: area.score,
        accuracy: area.accuracy,
        meanConfidence: area.meanConfidence,
        responseCount: area.responseCount,
      })),
    }
  }

  async runGetSessionHistory(ctx: InSessionToolContext): Promise<SessionHistoryPayload> {
    const raw = await this.history.read(ctx.userId, ctx.enrollmentId, SESSION_HISTORY_LIMIT)

    const trends = new Map<string, number[]>()
    for (const session of raw.sessions) {
      for (const { domain, accuracy } of session.domains) {
        const accuracies = trends.get(domain) ?? []
        accuracies.push(accuracy)
        trends.set(domain, accuracies)
      }
    }
    const domainTrends: DomainAccuracyTrend[] = [...trends.entries()].map(
      ([domain, accuracies]) => ({ domain, accuracies }),
    )

    return {
      tool: 'getSessionHistory',
      sessions: raw.sessions.map((session) => ({
        sessionId: session.sessionId,
        kind: session.kind,
        status: session.status,
        endedAt: session.endedAt ? session.endedAt.toISOString() : null,
        domains: session.domains,
      })),
      mockExams: raw.mockExams.map((mock) => ({
        mockExamId: mock.mockExamId,
        score: mock.score,
        submittedAt: mock.submittedAt ? mock.submittedAt.toISOString() : null,
      })),
      domainTrends,
    }
  }
}
