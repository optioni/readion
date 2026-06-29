import { EntityManager } from '@mikro-orm/core'
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { User } from '@readion/db'
import {
  type UpdateUserProfileRequest,
  type UserProfileResponse,
  updateUserProfileRequestSchema,
  type ValidationErrorItem,
} from '@readion/shared'
import type { z } from 'zod'
import { PasswordHashingService } from '../auth/password-hashing.service'
import { RefreshTokenStore } from '../auth/refresh-token.store'
import { LastActiveAdminGuard } from './last-active-admin.guard'

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    private readonly passwords: PasswordHashingService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly lastActiveAdmin: LastActiveAdminGuard,
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const em = this.em.fork()
    return this.toProfile(await this.findActiveUser(em, userId))
  }

  async updateProfile(userId: string, body: unknown): Promise<UserProfileResponse> {
    const input = parseBody(updateUserProfileRequestSchema, body)
    const em = this.em.fork()
    const user = await this.findActiveUser(em, userId)

    if (input.displayTimezone !== undefined) {
      user.displayTimezone = input.displayTimezone
    }

    if (input.digestOptOut !== undefined) {
      user.digestOptOut = input.digestOptOut
    }

    this.applySessionDefaults(user, input.sessionDefaults)

    await em.flush()
    return this.toProfile(user)
  }

  async deleteOwnAccount(userId: string, body: unknown): Promise<void> {
    const password = parsePasswordConfirmation(body)
    const em = this.em.fork()
    const user = await this.findActiveUser(em, userId)
    const passwordMatches = await this.passwords.verify(password, user.passwordHash)

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid password')
    }

    await this.lastActiveAdmin.assertCanDelete(user, em)

    user.deletedAt = new Date()
    await em.flush()
    await this.refreshTokens.revokeAllForUser(user.id)
  }

  private async findActiveUser(em: EntityManager, userId: string) {
    const user = await em.findOne(User, { id: userId, deletedAt: null })

    if (user === null) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  private applySessionDefaults(user: User, defaults: UpdateUserProfileRequest['sessionDefaults']) {
    if (defaults === undefined) {
      return
    }

    if (defaults.duration !== undefined) {
      user.sessionDefaultDuration = defaults.duration
    }

    if (defaults.contentMix !== undefined) {
      user.sessionDefaultContentMix = defaults.contentMix
    }

    if (defaults.difficulty !== undefined) {
      user.sessionDefaultDifficulty = defaults.difficulty
    }

    if (defaults.focusArea !== undefined) {
      user.sessionDefaultFocusArea = defaults.focusArea
    }

    if (defaults.learningStyle !== undefined) {
      user.sessionDefaultLearningStyle = defaults.learningStyle
    }
  }

  private toProfile(user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      displayTimezone: user.displayTimezone,
      digestOptOut: user.digestOptOut,
      sessionDefaults: {
        duration: user.sessionDefaultDuration,
        contentMix: user.sessionDefaultContentMix,
        difficulty: user.sessionDefaultDifficulty,
        focusArea: user.sessionDefaultFocusArea,
        learningStyle: user.sessionDefaultLearningStyle,
      },
    }
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

function parsePasswordConfirmation(body: unknown) {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('password' in body) ||
    typeof body.password !== 'string' ||
    body.password.length === 0
  ) {
    throw new UnprocessableEntityException({
      errors: [{ field: 'password', message: 'Password is required' }],
    })
  }

  return body.password
}

function toValidationError(issue: { path: PropertyKey[]; message: string }): ValidationErrorItem {
  return {
    field: issue.path.map(String).join('.') || 'body',
    message: issue.message,
  }
}
