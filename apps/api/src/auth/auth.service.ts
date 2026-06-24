import { EntityManager } from '@mikro-orm/core'
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { User, UserRole } from '@readion/db'
import type { AuthSessionResponse, AuthUser, RoleValue } from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'
import type { ConfiguredMailService } from '../mail/mail.service'
import { MailService } from '../mail/mail.service'
import { AccessTokenService } from './access-token.service'
import { PasswordHashingService } from './password-hashing.service'
import { RefreshTokenStore } from './refresh-token.store'
import { PasswordResetTokenService, VerificationTokenService } from './single-use-token.service'

type IssuedSession = AuthSessionResponse & {
  refreshToken: string
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password'
const PRODUCT_NAME = 'Readion'

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly passwords: PasswordHashingService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly verificationTokens: VerificationTokenService,
    private readonly passwordResetTokens: PasswordResetTokenService,
    private readonly config: ConfigService<EnvConfig>,
    @Inject(MailService)
    private readonly mail: ConfiguredMailService,
  ) {}

  async register(input: { email: string; password: string }): Promise<IssuedSession> {
    const em = this.em.fork()
    const existing = await this.findUserByEmail(em, input.email)

    if (existing !== null) {
      throw new ConflictException('Email is already taken')
    }

    const userCount = await em.count(User, {})
    const user = em.create(User, {
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
      emailVerified: false,
      role: userCount === 0 ? UserRole.Admin : UserRole.User,
    })

    em.persist(user)
    await em.flush()
    await this.sendVerificationEmail(user)

    return this.issueSession(user)
  }

  async login(input: { email: string; password: string }): Promise<IssuedSession> {
    const em = this.em.fork()
    const user = await this.findUserByEmail(em, input.email)

    if (user === null) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
    }

    const matches = await this.passwords.verify(input.password, user.passwordHash)

    if (!matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
    }

    return this.issueSession(user)
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const rotated = await this.refreshTokens.rotate(refreshToken)

    if (rotated === null) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const em = this.em.fork()
    const user = await em.findOne(User, { id: rotated.userId })

    if (user === null) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    return {
      accessToken: await this.accessTokens.issue({ userId: user.id, role: user.role }),
      refreshToken: rotated.token,
    }
  }

  async logout(refreshToken: string | null) {
    if (refreshToken !== null) {
      await this.refreshTokens.revoke(refreshToken)
    }

    return { ok: true }
  }

  async verifyEmail(token: string) {
    const consumed = await this.verificationTokens.consume(token)

    if (consumed === null) {
      throw new BadRequestException('Invalid verification token')
    }

    const em = this.em.fork()
    const user = await em.findOne(User, { id: consumed.userId })

    if (user === null) {
      throw new BadRequestException('Invalid verification token')
    }

    user.emailVerified = true
    await em.flush()
    return { ok: true }
  }

  async resendVerification(userId: string) {
    const em = this.em.fork()
    const user = await em.findOne(User, { id: userId })

    if (user === null) {
      throw new UnauthorizedException('Authentication required')
    }

    if (!user.emailVerified) {
      await this.sendVerificationEmail(user)
    }

    return { ok: true }
  }

  async forgotPassword(email: string) {
    const em = this.em.fork()
    const user = await this.findUserByEmail(em, email)

    if (user !== null) {
      const token = await this.passwordResetTokens.issue(user.id)
      await this.mail.send('passwordReset', user.email, {
        productName: PRODUCT_NAME,
        actionUrl: this.buildWebLink('/reset-password', token),
      })
    }

    return { accepted: true }
  }

  async validateResetToken(token: string) {
    const valid = await this.passwordResetTokens.validate(token)

    if (valid === null) {
      throw new BadRequestException('Invalid reset token')
    }

    return { valid: true }
  }

  async resetPassword(input: { token: string; password: string }) {
    const consumed = await this.passwordResetTokens.consume(input.token)

    if (consumed === null) {
      throw new BadRequestException('Invalid reset token')
    }

    const em = this.em.fork()
    const user = await em.findOne(User, { id: consumed.userId })

    if (user === null) {
      throw new BadRequestException('Invalid reset token')
    }

    user.passwordHash = await this.passwords.hash(input.password)
    await em.flush()
    await this.refreshTokens.revokeAllForUser(user.id)
    return { ok: true }
  }

  private async issueSession(user: User): Promise<IssuedSession> {
    const refreshToken = await this.refreshTokens.issue(user.id)
    return {
      user: this.toAuthUser(user),
      accessToken: await this.accessTokens.issue({ userId: user.id, role: user.role }),
      refreshToken: refreshToken.token,
    }
  }

  private async sendVerificationEmail(user: User) {
    const token = await this.verificationTokens.issue(user.id)
    await this.mail.send('emailVerification', user.email, {
      productName: PRODUCT_NAME,
      actionUrl: this.buildWebLink('/verify-email', token),
    })
  }

  private buildWebLink(path: string, token: string) {
    const url = new URL(path, this.config.get('WEB_BASE_URL') ?? 'http://localhost:3000')
    url.searchParams.set('token', token)
    return url.toString()
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role as RoleValue,
      emailVerified: user.emailVerified,
    }
  }

  private async findUserByEmail(em: EntityManager, email: string) {
    const rows = await em
      .getConnection()
      .execute<{ id: string }[]>('SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1', [
        email,
      ])

    if (rows.length === 0) {
      return null
    }

    return em.findOne(User, { id: rows[0].id })
  }
}
