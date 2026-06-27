import { z } from 'zod'

export const examOutcomeResponses = ['passed', 'did_not_pass', 'not_yet', 'dismissed'] as const

export type ExamOutcomeResponse = (typeof examOutcomeResponses)[number]

export const examOutcomeRequestSchema = z.object({
  outcome: z.enum(examOutcomeResponses),
})

export type ExamOutcomeRequest = z.infer<typeof examOutcomeRequestSchema>

export const lifecycleUserIdsRequestSchema = z.object({
  userIds: z.array(z.string().uuid()),
})

export type LifecycleDigestRequest = z.infer<typeof lifecycleUserIdsRequestSchema>
export type LifecycleNudgeRequest = z.infer<typeof lifecycleUserIdsRequestSchema>

export const EXAM_READY_THRESHOLD_DEFAULT = 80
export const NUDGE_MAX_FOLLOWUPS_DEFAULT = 1
export const DIGEST_SEND_WEEKDAY_DEFAULT = 1
export const DIGEST_SEND_HOUR_DEFAULT = 13
export const NUDGE_ACTIVITY_LULL_DAYS_DEFAULT = 7
export const NUDGE_FOLLOWUP_DELAY_DAYS_DEFAULT = 3
