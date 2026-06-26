import type { Provenance } from '../grounding'

export const mockExamTypes = ['mock', 'diagnostic'] as const
export type MockExamType = (typeof mockExamTypes)[number]

export const mockExamStatuses = ['in_progress', 'submitted', 'expired'] as const
export type MockExamStatus = (typeof mockExamStatuses)[number]

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
