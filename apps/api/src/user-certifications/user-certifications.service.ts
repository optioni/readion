import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/core'
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Certification, User, UserCertification } from '@readion/db'
import {
  type EnrollmentResponse,
  type EnrollmentStatus,
  type SessionDefaults,
  type UpdateEnrollmentRequest,
  updateEnrollmentRequestSchema,
  type ValidationErrorItem,
} from '@readion/shared'
import type { z } from 'zod'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { resolveEnrollmentDecision } from './enrollment-decision'
import { mapUserCertificationToDto } from './user-certifications.mapper'

@Injectable()
export class UserCertificationsService {
  constructor(private readonly em: EntityManager) {}

  async enroll(
    userId: string,
    certificationId: string,
    sessionDefaults?: Partial<SessionDefaults>,
  ): Promise<EnrollmentResponse> {
    const em = this.em.fork()

    const cert = await em.findOne(Certification, { id: certificationId, state: 'live' })
    if (cert === null) {
      throw new NotFoundException('Certification not found')
    }

    const existing = await em.findOne(
      UserCertification,
      { user: userId, certification: certificationId },
      { populate: ['certification'] },
    )

    const decision = resolveEnrollmentDecision(existing?.status ?? null)

    if (decision === 'conflict') {
      throw new ConflictException('Already enrolled in this certification')
    }

    if (decision === 'restore' && existing !== null) {
      existing.status = 'active'
      await em.flush()
      return mapUserCertificationToDto(existing)
    }

    const enrollment = em.create(UserCertification, {
      user: em.getReference(User, userId),
      certification: cert,
    })
    applySessionOverrides(enrollment, sessionDefaults)

    try {
      em.persist(enrollment)
      await em.flush()
    } catch (err) {
      if (err instanceof UniqueConstraintViolationException) {
        throw new ConflictException('Already enrolled in this certification')
      }
      throw err
    }

    await em.populate(enrollment, ['certification'])
    return mapUserCertificationToDto(enrollment)
  }

  async list(
    userId: string,
    status: EnrollmentStatus = 'active',
  ): Promise<CollectionResult<EnrollmentResponse>> {
    const em = this.em.fork()
    const [enrollments, total] = await em.findAndCount(
      UserCertification,
      { user: userId, status },
      { populate: ['certification'], orderBy: { enrolledAt: 'ASC' } },
    )

    return {
      items: enrollments.map(mapUserCertificationToDto),
      meta: { total, page: 1, limit: total },
    }
  }

  async findOne(userId: string, id: string): Promise<EnrollmentResponse> {
    const em = this.em.fork()
    const enrollment = await em.findOne(
      UserCertification,
      { id, user: userId },
      { populate: ['certification'] },
    )

    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    return mapUserCertificationToDto(enrollment)
  }

  async updateOverrides(userId: string, id: string, body: unknown): Promise<EnrollmentResponse> {
    const input = parseBody(updateEnrollmentRequestSchema, body)
    const em = this.em.fork()

    const enrollment = await em.findOne(
      UserCertification,
      { id, user: userId },
      { populate: ['certification'] },
    )

    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    applyNullableSessionOverrides(enrollment, input.sessionDefaults)
    await em.flush()

    return mapUserCertificationToDto(enrollment)
  }

  async archive(userId: string, id: string): Promise<EnrollmentResponse> {
    const em = this.em.fork()
    const enrollment = await em.findOne(
      UserCertification,
      { id, user: userId },
      { populate: ['certification'] },
    )

    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    enrollment.status = 'archived'
    await em.flush()

    return mapUserCertificationToDto(enrollment)
  }

  async restore(userId: string, id: string): Promise<EnrollmentResponse> {
    const em = this.em.fork()
    const enrollment = await em.findOne(
      UserCertification,
      { id, user: userId },
      { populate: ['certification'] },
    )

    if (enrollment === null) {
      throw new NotFoundException('Enrollment not found')
    }

    enrollment.status = 'active'
    await em.flush()

    return mapUserCertificationToDto(enrollment)
  }
}

function applySessionOverrides(
  enrollment: UserCertification,
  overrides?: Partial<SessionDefaults>,
) {
  if (overrides === undefined) return

  if (overrides.duration !== undefined) {
    enrollment.sessionOverrideDuration = overrides.duration
  }
  if (overrides.contentMix !== undefined) {
    enrollment.sessionOverrideContentMix = overrides.contentMix
  }
  if (overrides.difficulty !== undefined) {
    enrollment.sessionOverrideDifficulty = overrides.difficulty
  }
  if (overrides.focusArea !== undefined) {
    enrollment.sessionOverrideFocusArea = overrides.focusArea
  }
  if (overrides.learningStyle !== undefined) {
    enrollment.sessionOverrideLearningStyle = overrides.learningStyle
  }
}

function applyNullableSessionOverrides(
  enrollment: UserCertification,
  overrides?: UpdateEnrollmentRequest['sessionDefaults'],
) {
  if (overrides === undefined) return

  if ('duration' in overrides) {
    enrollment.sessionOverrideDuration = overrides.duration ?? null
  }
  if ('contentMix' in overrides) {
    enrollment.sessionOverrideContentMix = overrides.contentMix ?? null
  }
  if ('difficulty' in overrides) {
    enrollment.sessionOverrideDifficulty = overrides.difficulty ?? null
  }
  if ('focusArea' in overrides) {
    enrollment.sessionOverrideFocusArea = overrides.focusArea ?? null
  }
  if ('learningStyle' in overrides) {
    enrollment.sessionOverrideLearningStyle = overrides.learningStyle ?? null
  }
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)

  if (!result.success) {
    throw new UnprocessableEntityException({
      errors: result.error.issues.map(toValidationError),
    })
  }

  return result.data
}

function toValidationError(issue: { path: PropertyKey[]; message: string }): ValidationErrorItem {
  return {
    field: issue.path.map(String).join('.') || 'body',
    message: issue.message,
  }
}
