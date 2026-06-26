import type { ModelMessage } from 'ai'
import type { WeakAreaDto } from '../../weak-areas/weak-areas.service'

export type InSessionToolContext = {
  userId: string
  sessionId: string
  certificationId: string
  enrollmentId: string
}

export const AGENT_TOOL_NAMES = [
  'semanticSearch',
  'fetchMoreMaterial',
  'explainAnswer',
  'examStrategy',
  'getUserProgress',
  'getSessionHistory',
] as const

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]

const INTERNAL_TOOLS: ReadonlySet<string> = new Set<AgentToolName>(['semanticSearch'])

export function isInternalTool(toolName: string): boolean {
  return INTERNAL_TOOLS.has(toolName)
}

export type RetrievedChunk = {
  id: string
  text: string
  similarity: number
  sourceUrl: string
  primaryDomain: string
}

export type ItemProvenance = {
  content: string
  sourceChunkIds: string[]
  supportingSpans: string[]
}

export type ReadinessSnapshot = {
  calibrated: boolean
  score: number | null
}

export type RawSessionStat = {
  sessionId: string
  kind: string
  status: string
  endedAt: Date | null
  domains: { domain: string; accuracy: number }[]
}

export type RawMockStat = {
  mockExamId: string
  score: number | null
  submittedAt: Date | null
}

export type SessionHistoryRead = {
  sessions: RawSessionStat[]
  mockExams: RawMockStat[]
}

export interface EmbeddingPort {
  embed(text: string): Promise<number[]>
}

export interface MaterialGenerationPort {
  generateText(options: {
    taskType: 'material-generation' | 'agent-qa'
    messages: ModelMessage[]
    system?: string
  }): Promise<{ text: string }>
}

export interface RetrievalPort {
  searchChunks(
    certificationId: string,
    queryEmbedding: number[],
    options: { threshold: number; limit: number },
  ): Promise<RetrievedChunk[]>
  getChunksByIds(certificationId: string, ids: string[]): Promise<RetrievedChunk[]>
}

export interface ProvenancePort {
  findOwnedProvenance(
    userId: string,
    sessionId: string,
    itemIndex: number,
  ): Promise<ItemProvenance | null>
}

export interface WeakAreasPort {
  listForEnrollment(userId: string, enrollmentId: string): Promise<WeakAreaDto[]>
}

export interface ReadinessPort {
  readForOwner(userId: string, enrollmentId: string): Promise<ReadinessSnapshot>
}

export interface SessionHistoryPort {
  read(userId: string, enrollmentId: string, limit: number): Promise<SessionHistoryRead>
}

export type MaterialIngestionJobData = {
  certificationId: string
  topic: string
  requestedByUserId: string
  sessionId: string
}

export interface MaterialIngestionQueue {
  add(
    name: string,
    data: MaterialIngestionJobData,
    options: { priority: number },
  ): Promise<{ id?: string | null }>
}

export type AgentToolsConfig = {
  similarityThreshold: number
  semanticSearchLimit: number
  abstentionGuidance: string
}

export type ChunkCitation = {
  chunkId: string
  sourceUrl: string
  primaryDomain: string
}

export type SemanticSearchPayload = {
  tool: 'semanticSearch'
  internal: true
  chunks: RetrievedChunk[]
}

export type FetchMoreMaterialPayload =
  | { tool: 'fetchMoreMaterial'; status: 'inline'; content: string }
  | { tool: 'fetchMoreMaterial'; status: 'enqueued'; jobId: string }

export type ExplainAnswerPayload = {
  tool: 'explainAnswer'
  explanation: string
  supportingSpans: string[]
  citations: ChunkCitation[]
}

export type ExamStrategyPayload = {
  tool: 'examStrategy'
  domain: string
  questionType: string | null
  advice: string
}

export type DomainProgress = {
  domain: string
  score: number
  accuracy: number
  meanConfidence: number
  responseCount: number
}

export type UserProgressPayload = {
  tool: 'getUserProgress'
  readiness: ReadinessSnapshot
  domains: DomainProgress[]
}

export type SessionHistoryEntry = {
  sessionId: string
  kind: string
  status: string
  endedAt: string | null
  domains: { domain: string; accuracy: number }[]
}

export type MockExamHistoryEntry = {
  mockExamId: string
  score: number | null
  submittedAt: string | null
}

export type DomainAccuracyTrend = {
  domain: string
  accuracies: number[]
}

export type SessionHistoryPayload = {
  tool: 'getSessionHistory'
  sessions: SessionHistoryEntry[]
  mockExams: MockExamHistoryEntry[]
  domainTrends: DomainAccuracyTrend[]
}

export type AgentToolPayload =
  | SemanticSearchPayload
  | FetchMoreMaterialPayload
  | ExplainAnswerPayload
  | ExamStrategyPayload
  | UserProgressPayload
  | SessionHistoryPayload

export const AGENT_EMBEDDING_PORT = Symbol('AGENT_EMBEDDING_PORT')
export const AGENT_MATERIAL_GENERATION_PORT = Symbol('AGENT_MATERIAL_GENERATION_PORT')
export const AGENT_RETRIEVAL_PORT = Symbol('AGENT_RETRIEVAL_PORT')
export const AGENT_PROVENANCE_PORT = Symbol('AGENT_PROVENANCE_PORT')
export const AGENT_WEAK_AREAS_PORT = Symbol('AGENT_WEAK_AREAS_PORT')
export const AGENT_READINESS_PORT = Symbol('AGENT_READINESS_PORT')
export const AGENT_SESSION_HISTORY_PORT = Symbol('AGENT_SESSION_HISTORY_PORT')
export const AGENT_MATERIAL_QUEUE = Symbol('AGENT_MATERIAL_QUEUE')
export const AGENT_TOOLS_CONFIG = Symbol('AGENT_TOOLS_CONFIG')
