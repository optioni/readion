import type { Provenance } from '../grounding'

export const MOCK_EXAM_GENERATION_QUEUE = 'mock-exam-generation'

export interface MockExamGenerationJobPayload {
  attemptId: string
}

export const mockExamTypes = ['mock', 'diagnostic'] as const
export type MockExamType = (typeof mockExamTypes)[number]

export const mockExamStatuses = ['in_progress', 'submitted', 'expired'] as const
export type MockExamStatus = (typeof mockExamStatuses)[number]

export const mockExamGenerations = ['preparing', 'ready'] as const
export type MockExamGeneration = (typeof mockExamGenerations)[number]

export interface MockExamQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  selectedAnswer: string | null
  domain: string
  provenance: Provenance
}

export interface MockExamDomainStat {
  correct: number
  total: number
  accuracy: number
}

export type MockExamDomainBreakdown = Record<string, MockExamDomainStat>

export interface MockExamCitation {
  chunkId: string
  text: string
}

export interface MockExamQuestionResponse {
  id: string
  question: string
  options: string[]
  domain: string
  userAnswer: string | null
  correctAnswer?: string
  explanation?: string
  citations?: MockExamCitation[]
}

export interface MockExamResponse {
  id: string
  userCertificationId: string
  type: MockExamType
  status: MockExamStatus
  generation: MockExamGeneration
  startedAt: string | null
  deadline: string | null
  remainingSeconds: number | null
  score: number | null
  passed: boolean | null
  domainBreakdown: MockExamDomainBreakdown
  questions: MockExamQuestionResponse[]
}
