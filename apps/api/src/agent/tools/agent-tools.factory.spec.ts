import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { AgentToolsFactory } from './agent-tools.factory'
import type {
  AgentToolsConfig,
  EmbeddingPort,
  InSessionToolContext,
  MaterialGenerationPort,
  MaterialIngestionQueue,
  ProvenancePort,
  ReadinessPort,
  RetrievalPort,
  RetrievedChunk,
  SessionHistoryPort,
  WeakAreasPort,
} from './agent-tools.types'
import { AGENT_TOOL_NAMES, isInternalTool } from './agent-tools.types'

const ctx: InSessionToolContext = {
  userId: 'user-1',
  sessionId: 'session-1',
  certificationId: 'cert-1',
  enrollmentId: 'enrollment-1',
}

const config: AgentToolsConfig = {
  similarityThreshold: 0.75,
  semanticSearchLimit: 5,
  abstentionGuidance: 'abstain rather than guess: say "I don\'t have enough material on that"',
}

const chunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  id: 'chunk-1',
  text: 'EC2 provides resizable compute capacity.',
  similarity: 0.91,
  sourceUrl: 'https://docs.aws.amazon.com/ec2',
  primaryDomain: 'compute',
  ...overrides,
})

type Ports = {
  embedding: EmbeddingPort
  llm: MaterialGenerationPort
  retrieval: RetrievalPort
  provenance: ProvenancePort
  weakAreas: WeakAreasPort
  readiness: ReadinessPort
  history: SessionHistoryPort
  queue: MaterialIngestionQueue
}

function buildPorts(overrides: Partial<Ports> = {}): Ports {
  return {
    embedding: { embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]) },
    llm: { generateText: vi.fn().mockResolvedValue({ text: 'generated material' }) },
    retrieval: {
      searchChunks: vi.fn().mockResolvedValue([]),
      getChunksByIds: vi.fn().mockResolvedValue([]),
    },
    provenance: { findOwnedProvenance: vi.fn().mockResolvedValue(null) },
    weakAreas: { listForEnrollment: vi.fn().mockResolvedValue([]) },
    readiness: {
      readForOwner: vi.fn().mockResolvedValue({ calibrated: false, score: null }),
    },
    history: { read: vi.fn().mockResolvedValue({ sessions: [], mockExams: [] }) },
    queue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
    ...overrides,
  }
}

function buildFactory(overrides: Partial<Ports> = {}): {
  factory: AgentToolsFactory
  ports: Ports
} {
  const ports = buildPorts(overrides)
  const factory = new AgentToolsFactory(
    ports.embedding,
    ports.llm,
    ports.retrieval,
    ports.provenance,
    ports.weakAreas,
    ports.readiness,
    ports.history,
    ports.queue,
    config,
  )
  return { factory, ports }
}

describe('AgentToolsFactory tool set selection', () => {
  it('exposes exactly the six cert-scoped tools for an in-session turn', () => {
    const { factory } = buildFactory()
    const tools = factory.buildInSessionTools(ctx)
    expect(Object.keys(tools).sort()).toEqual([...AGENT_TOOL_NAMES].sort())
  })

  it('exposes no tools for a standalone turn', () => {
    const { factory } = buildFactory()
    expect(factory.buildStandaloneTools()).toEqual({})
  })
})

describe('semanticSearch', () => {
  it('embeds the query and returns cert-scoped ranked capped chunks marked internal', async () => {
    const { factory, ports } = buildFactory({
      embedding: { embed: vi.fn().mockResolvedValue([0.4, 0.5, 0.6]) },
      retrieval: {
        searchChunks: vi
          .fn()
          .mockResolvedValue([
            chunk({ id: 'a', similarity: 0.95 }),
            chunk({ id: 'b', similarity: 0.8 }),
          ]),
        getChunksByIds: vi.fn().mockResolvedValue([]),
      },
    })

    const result = await factory.runSemanticSearch(ctx, { query: 'what is ec2' })

    expect(ports.embedding.embed).toHaveBeenCalledWith('what is ec2')
    expect(ports.retrieval.searchChunks).toHaveBeenCalledWith('cert-1', [0.4, 0.5, 0.6], {
      threshold: 0.75,
      limit: 5,
    })
    expect(result.tool).toBe('semanticSearch')
    expect(result.internal).toBe(true)
    expect(result.chunks.map((c) => c.id)).toEqual(['a', 'b'])
  })
})

describe('fetchMoreMaterial fast vs slow decision', () => {
  it('FAST: generates inline from chunks above threshold and enqueues no job', async () => {
    const { factory, ports } = buildFactory({
      retrieval: {
        searchChunks: vi.fn().mockResolvedValue([chunk()]),
        getChunksByIds: vi.fn().mockResolvedValue([]),
      },
      llm: { generateText: vi.fn().mockResolvedValue({ text: 'expanded material on EC2' }) },
    })

    const result = await factory.runFetchMoreMaterial(ctx, { topic: 'ec2 pricing' })

    expect(result).toEqual({
      tool: 'fetchMoreMaterial',
      status: 'inline',
      content: 'expanded material on EC2',
    })
    expect(ports.llm.generateText).toHaveBeenCalledOnce()
    expect(ports.queue.add).not.toHaveBeenCalled()
  })

  it('SLOW: enqueues a high-priority ingestion job and returns a jobId without inline content', async () => {
    const { factory, ports } = buildFactory({
      retrieval: {
        searchChunks: vi.fn().mockResolvedValue([]),
        getChunksByIds: vi.fn().mockResolvedValue([]),
      },
      queue: { add: vi.fn().mockResolvedValue({ id: 'job-42' }) },
    })

    const result = await factory.runFetchMoreMaterial(ctx, { topic: 'obscure topic' })

    expect(result).toEqual({ tool: 'fetchMoreMaterial', status: 'enqueued', jobId: 'job-42' })
    expect(ports.queue.add).toHaveBeenCalledOnce()
    const [, jobData, jobOpts] = (ports.queue.add as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(jobData).toMatchObject({
      certificationId: 'cert-1',
      topic: 'obscure topic',
      requestedByUserId: 'user-1',
      sessionId: 'session-1',
    })
    expect(jobOpts.priority).toBe(1)
    expect(ports.llm.generateText).not.toHaveBeenCalled()
  })
})

describe('explainAnswer', () => {
  it('derives a structured explanation and citation from stored provenance', async () => {
    const { factory, ports } = buildFactory({
      provenance: {
        findOwnedProvenance: vi.fn().mockResolvedValue({
          content: JSON.stringify({ question: 'Which service is serverless compute?' }),
          sourceChunkIds: ['chunk-1', 'chunk-2'],
          supportingSpans: ['Lambda runs code without provisioning servers.'],
        }),
      },
      retrieval: {
        searchChunks: vi.fn().mockResolvedValue([]),
        getChunksByIds: vi
          .fn()
          .mockResolvedValue([
            chunk({ id: 'chunk-1', sourceUrl: 'https://docs.aws.amazon.com/lambda' }),
            chunk({ id: 'chunk-2', sourceUrl: 'https://docs.aws.amazon.com/fargate' }),
          ]),
      },
      llm: {
        generateText: vi.fn().mockResolvedValue({ text: 'Lambda is the serverless option.' }),
      },
    })

    const result = await factory.runExplainAnswer(ctx, { itemIndex: 3 })

    expect(ports.provenance.findOwnedProvenance).toHaveBeenCalledWith('user-1', 'session-1', 3)
    expect(ports.retrieval.getChunksByIds).toHaveBeenCalledWith('cert-1', ['chunk-1', 'chunk-2'])
    expect(result.tool).toBe('explainAnswer')
    expect(result.explanation).toBe('Lambda is the serverless option.')
    expect(result.supportingSpans).toEqual(['Lambda runs code without provisioning servers.'])
    expect(result.citations.map((c) => c.chunkId)).toEqual(['chunk-1', 'chunk-2'])
    expect(result.citations[0]?.sourceUrl).toBe('https://docs.aws.amazon.com/lambda')
  })

  it('yields not-found when the item belongs to another user (no provenance)', async () => {
    const { factory } = buildFactory({
      provenance: { findOwnedProvenance: vi.fn().mockResolvedValue(null) },
    })

    await expect(factory.runExplainAnswer(ctx, { itemIndex: 7 })).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})

describe('getUserProgress', () => {
  it('returns readiness plus ranked per-domain weak-area scores and confidence', async () => {
    const { factory } = buildFactory({
      readiness: {
        readForOwner: vi.fn().mockResolvedValue({ calibrated: true, score: 0.62 }),
      },
      weakAreas: {
        listForEnrollment: vi.fn().mockResolvedValue([
          {
            id: 'w1',
            domain: 'security',
            score: 0.3,
            accuracy: 0.4,
            meanConfidence: 2,
            responseCount: 10,
          },
          {
            id: 'w2',
            domain: 'compute',
            score: 0.7,
            accuracy: 0.8,
            meanConfidence: 4,
            responseCount: 12,
          },
        ]),
      },
    })

    const result = await factory.runGetUserProgress(ctx)

    expect(result.tool).toBe('getUserProgress')
    expect(result.readiness).toEqual({ calibrated: true, score: 0.62 })
    expect(result.domains.map((d) => d.domain)).toEqual(['security', 'compute'])
    expect(result.domains[0]).toMatchObject({ score: 0.3, accuracy: 0.4, meanConfidence: 2 })
  })
})

describe('getSessionHistory', () => {
  it('returns recent sessions with per-domain accuracy trends and mock exams when available', async () => {
    const endedAt = new Date('2026-06-20T10:00:00.000Z')
    const { factory } = buildFactory({
      history: {
        read: vi.fn().mockResolvedValue({
          sessions: [
            {
              sessionId: 'sess-a',
              kind: 'study',
              status: 'completed',
              endedAt,
              domains: [{ domain: 'compute', accuracy: 0.5 }],
            },
            {
              sessionId: 'sess-b',
              kind: 'study',
              status: 'completed',
              endedAt: null,
              domains: [{ domain: 'compute', accuracy: 0.8 }],
            },
          ],
          mockExams: [{ mockExamId: 'mock-1', score: 0.7, submittedAt: endedAt }],
        }),
      },
    })

    const result = await factory.runGetSessionHistory(ctx)

    expect(result.tool).toBe('getSessionHistory')
    expect(result.sessions.map((s) => s.sessionId)).toEqual(['sess-a', 'sess-b'])
    expect(result.sessions[0]?.endedAt).toBe(endedAt.toISOString())
    expect(result.mockExams).toHaveLength(1)
    const computeTrend = result.domainTrends.find((t) => t.domain === 'compute')
    expect(computeTrend?.accuracies).toEqual([0.5, 0.8])
  })

  it('degrades to session-only history when no mock-exam data exists', async () => {
    const { factory } = buildFactory({
      history: {
        read: vi.fn().mockResolvedValue({
          sessions: [
            {
              sessionId: 'sess-a',
              kind: 'study',
              status: 'partial',
              endedAt: null,
              domains: [],
            },
          ],
          mockExams: [],
        }),
      },
    })

    const result = await factory.runGetSessionHistory(ctx)

    expect(result.mockExams).toEqual([])
    expect(result.sessions).toHaveLength(1)
  })
})

describe('examStrategy', () => {
  it('returns a structured strategy tip distinct from chat text', async () => {
    const { factory, ports } = buildFactory({
      llm: { generateText: vi.fn().mockResolvedValue({ text: 'Eliminate wrong options first.' }) },
    })

    const result = await factory.runExamStrategy(ctx, {
      domain: 'security',
      questionType: 'scenario',
    })

    expect(result.tool).toBe('examStrategy')
    expect(result.domain).toBe('security')
    expect(result.questionType).toBe('scenario')
    expect(result.advice).toBe('Eliminate wrong options first.')
    expect(ports.llm.generateText).toHaveBeenCalledOnce()
  })

  it('tolerates an absent question type', async () => {
    const { factory } = buildFactory()
    const result = await factory.runExamStrategy(ctx, { domain: 'networking' })
    expect(result.questionType).toBeNull()
  })
})

describe('structured payload shaping', () => {
  it('marks only semanticSearch as internal', () => {
    expect(isInternalTool('semanticSearch')).toBe(true)
    for (const name of AGENT_TOOL_NAMES.filter((n) => n !== 'semanticSearch')) {
      expect(isInternalTool(name)).toBe(false)
    }
  })
})
