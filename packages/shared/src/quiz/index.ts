import { z } from 'zod'
import type { Provenance } from '../grounding'

export const questionFormats = ['multiple_choice', 'true_false', 'scenario'] as const
export type QuestionFormat = (typeof questionFormats)[number]

export const quizDifficulties = ['beginner', 'intermediate', 'advanced', 'exam-ready'] as const
export type QuizDifficulty = (typeof quizDifficulties)[number]

export const generateQuizRequestSchema = z.object({
  userCertificationId: z.string().uuid(),
  domain: z.string().min(1),
  difficulty: z.enum(quizDifficulties),
  format: z.enum(questionFormats).optional(),
})
export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>

export const submitAnswerRequestSchema = z.object({
  userCertificationId: z.string().uuid(),
  answer: z.string().min(1),
  confidence: z.number().int().min(1).max(5),
  timeTakenMs: z.number().int().min(0),
})
export type SubmitAnswerRequest = z.infer<typeof submitAnswerRequestSchema>

export const explanationRequestSchema = z.object({
  userCertificationId: z.string().uuid(),
})
export type ExplanationRequest = z.infer<typeof explanationRequestSchema>

export const reportRequestSchema = z.object({
  userCertificationId: z.string().uuid(),
  reason: z.string().min(1),
})
export type ReportRequest = z.infer<typeof reportRequestSchema>

export interface QuizQuestionResponse {
  id: string
  format: QuestionFormat
  question: string
  options: string[]
  provenance: Provenance
}

export interface SubmitAnswerResponse {
  id: string
  correct: boolean
  answer: string
  confidence: number
  timeTakenMs: number
  userCertificationId: string
}

export interface ExplanationResponse {
  explanation: string
  citations: string[]
}

export interface InsufficientMaterialResponse {
  type: 'insufficient_material'
  certificationId: string
  domain: string
}

export type QuizGenerationResult =
  | { type: 'question'; data: QuizQuestionResponse }
  | InsufficientMaterialResponse
