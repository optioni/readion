import { z } from 'zod'
import type { SessionResponse } from '../sessions'

export const reviewItemStates = ['active', 'mastered', 'suppressed'] as const
export type ReviewItemState = (typeof reviewItemStates)[number]

export const LEITNER_INTERVALS_DAYS_DEFAULT = [1, 3, 7, 16, 35] as const

export const LEITNER_CONFIDENT_THRESHOLD = 3

export const REVIEW_SESSION_QUESTION_CAP_DEFAULT = 7

export interface ReviewItemResponse {
  id: string
  userCertificationId: string
  anchorChunkId: string
  domain: string
  box: number
  state: ReviewItemState
  dueAt: string
  lastReviewedAt: string | null
}

export interface ReviewQueueMeta {
  dueCount: number
  total: number
}

export type StartReviewResponse =
  | { status: 'started'; session: SessionResponse }
  | { status: 'all_caught_up' }

export const suppressDomainRequestSchema = z.object({
  domain: z.string().min(1),
})
export type SuppressDomainRequest = z.infer<typeof suppressDomainRequestSchema>

export interface SuppressDomainResponse {
  suppressedCount: number
}
