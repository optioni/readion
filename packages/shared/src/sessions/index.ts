import { z } from 'zod'

export const sessionDurationMinutes = [15, 30, 60, 90] as const
export type SessionDurationMinutes = (typeof sessionDurationMinutes)[number]

export const sessionContentMixes = [
  'balanced',
  'reading-heavy',
  'quiz-heavy',
  'video-based',
] as const
export type SessionContentMix = (typeof sessionContentMixes)[number]

export const sessionDifficulties = ['beginner', 'intermediate', 'exam-ready'] as const
export type SessionDifficulty = (typeof sessionDifficulties)[number]

export const sessionLearningStyles = ['weak-area-focus', 'spaced-repetition', 'cram'] as const
export type SessionLearningStyle = (typeof sessionLearningStyles)[number]

export const sessionStatuses = ['active', 'completed', 'partial', 'abandoned'] as const
export type SessionStatus = (typeof sessionStatuses)[number]

export const sessionKinds = ['study', 'review'] as const
export type SessionKind = (typeof sessionKinds)[number]

export const sessionItemTypes = ['reading', 'quiz', 'video'] as const
export type SessionItemType = (typeof sessionItemTypes)[number]

export const sessionFocusAreaSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({ mode: z.literal('domains'), domains: z.array(z.string()).min(1) }),
])

export type SessionFocusArea = z.infer<typeof sessionFocusAreaSchema>

export const createSessionRequestSchema = z.object({
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]).optional(),
  contentMix: z.enum(sessionContentMixes).optional(),
  difficulty: z.enum(sessionDifficulties).optional(),
  focusArea: sessionFocusAreaSchema.optional(),
  learningStyle: z.enum(sessionLearningStyles).optional(),
})

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>

export interface SessionConfig {
  durationMinutes: SessionDurationMinutes
  contentMix: SessionContentMix
  difficulty: SessionDifficulty
  focusArea: SessionFocusArea
  learningStyle: SessionLearningStyle
}

export interface SessionItemResponse {
  index: number
  type: SessionItemType
  content: string
  completed: boolean
  sourceChunkIds: string[]
  supportingSpans: string[]
}

export interface SessionResponse {
  id: string
  userCertificationId: string
  kind: SessionKind
  status: SessionStatus
  durationMinutes: number
  contentMix: string
  difficulty: string
  focusArea: SessionFocusArea
  learningStyle: string
  lastItemIndex: number
  startedAt: string
  endedAt: string | null
}

export interface SessionWithItemsResponse extends SessionResponse {
  items: SessionItemResponse[]
}

export interface SessionListMeta {
  total: number
  page: number
  limit: number
}

export interface SessionItemPlan {
  index: number
  type: 'reading' | 'quiz'
  domain: string
  format?: 'multiple_choice' | 'true_false' | 'scenario'
}

export interface SessionFillJobPayload {
  sessionId: string
  startFromIndex: number
  remainingItems: SessionItemPlan[]
  certificationId: string
  enrollmentId: string
  difficulty: string
  contentMix: string
}

export const SESSION_FILL_QUEUE = 'session-fill'
