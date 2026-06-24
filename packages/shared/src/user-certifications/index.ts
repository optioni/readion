import { z } from 'zod'
import {
  sessionDefaultContentMixes,
  sessionDefaultDifficulties,
  sessionDefaultFocusAreas,
  sessionDefaultLearningStyles,
} from '../users'

export const enrollmentStatuses = ['active', 'archived'] as const

export type EnrollmentStatus = (typeof enrollmentStatuses)[number]

const sessionOverridesEnrollSchema = z.object({
  duration: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]).optional(),
  contentMix: z.enum(sessionDefaultContentMixes).optional(),
  difficulty: z.enum(sessionDefaultDifficulties).optional(),
  focusArea: z.enum(sessionDefaultFocusAreas).optional(),
  learningStyle: z.enum(sessionDefaultLearningStyles).optional(),
})

const sessionOverridesUpdateSchema = z.object({
  duration: z
    .union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)])
    .nullable()
    .optional(),
  contentMix: z.enum(sessionDefaultContentMixes).nullable().optional(),
  difficulty: z.enum(sessionDefaultDifficulties).nullable().optional(),
  focusArea: z.enum(sessionDefaultFocusAreas).nullable().optional(),
  learningStyle: z.enum(sessionDefaultLearningStyles).nullable().optional(),
})

export const enrollCertificationRequestSchema = z.object({
  certificationId: z.string().uuid(),
  sessionDefaults: sessionOverridesEnrollSchema.optional(),
})

export const updateEnrollmentRequestSchema = z.object({
  sessionDefaults: sessionOverridesUpdateSchema.optional(),
})

export interface EnrollmentSessionOverrides {
  duration: number | null
  contentMix: string | null
  difficulty: string | null
  focusArea: string | null
  learningStyle: string | null
}

export interface EnrollmentResponse {
  id: string
  certificationId: string
  status: EnrollmentStatus
  enrolledAt: string
  sessionDefaults: EnrollmentSessionOverrides
}

export type EnrollCertificationRequest = z.infer<typeof enrollCertificationRequestSchema>
export type UpdateEnrollmentRequest = z.infer<typeof updateEnrollmentRequestSchema>
