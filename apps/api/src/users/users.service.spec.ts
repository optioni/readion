import { EntityManager } from '@mikro-orm/core'
import {
  ConflictException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { DEFAULT_SESSION_DEFAULTS } from '@readion/shared'
import { describe, expect, it, vi } from 'vitest'
import { LastActiveAdminGuard } from './last-active-admin.guard'
import { UsersService } from './users.service'

describe('UsersService', () => {
  it('returns the current user profile without passwordHash', async () => {
    const { service } = makeService()

    const profile = await service.getProfile('user-1')

    expect(profile).toEqual({
      id: 'user-1',
      email: 'ada@example.com',
      role: 'user',
      emailVerified: true,
      displayTimezone: 'Europe/Helsinki',
      sessionDefaults: DEFAULT_SESSION_DEFAULTS,
    })
    expect(profile).not.toHaveProperty('passwordHash')
  })

  it('updates timezone and partial session defaults', async () => {
    const { em, service, user } = makeService()

    const profile = await service.updateProfile('user-1', {
      displayTimezone: 'America/New_York',
      sessionDefaults: {
        duration: 60,
        learningStyle: 'spaced-repetition',
      },
    })

    expect(profile.displayTimezone).toBe('America/New_York')
    expect(profile.sessionDefaults).toEqual({
      ...DEFAULT_SESSION_DEFAULTS,
      duration: 60,
      learningStyle: 'spaced-repetition',
    })
    expect(user.displayTimezone).toBe('America/New_York')
    expect(user.sessionDefaultDuration).toBe(60)
    expect(user.sessionDefaultLearningStyle).toBe('spaced-repetition')
    expect(em.flush).toHaveBeenCalledOnce()
  })

  it('rejects invalid timezone and out-of-set preference values', async () => {
    const { service } = makeService()

    await expect(
      service.updateProfile('user-1', { displayTimezone: 'Mars/Olympus' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
    await expect(
      service.updateProfile('user-1', { sessionDefaults: { duration: 45 } }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
  })

  it('ignores immutable fields', async () => {
    const { service, user } = makeService()

    await service.updateProfile('user-1', {
      email: 'new@example.com',
      role: 'admin',
      emailVerified: false,
      displayTimezone: 'America/New_York',
    })

    expect(user.email).toBe('ada@example.com')
    expect(user.role).toBe('user')
    expect(user.emailVerified).toBe(true)
  })

  it('rejects a wrong password without changing account state', async () => {
    const { passwords, refreshTokens, service, user, em } = makeService({
      passwordMatches: false,
    })

    await expect(
      service.deleteOwnAccount('user-1', { password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(passwords.verify).toHaveBeenCalledWith('wrong-password', user.passwordHash)
    expect(user.deletedAt).toBeNull()
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('soft-deletes the account and revokes refresh tokens when the password is correct', async () => {
    const { refreshTokens, service, user, em } = makeService()

    await service.deleteOwnAccount('user-1', { password: 'correcthorse' })

    expect(user.deletedAt).toBeInstanceOf(Date)
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1')
    expect(em.flush).toHaveBeenCalledOnce()
  })

  it('blocks deletion of the last active admin', async () => {
    const { refreshTokens, service, user, em } = makeService({
      role: 'admin',
      activeAdminCount: 1,
    })

    await expect(
      service.deleteOwnAccount('user-1', { password: 'correcthorse' }),
    ).rejects.toBeInstanceOf(ConflictException)

    expect(user.deletedAt).toBeNull()
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })
})

function makeService(
  options: { activeAdminCount?: number; passwordMatches?: boolean; role?: 'admin' | 'user' } = {},
) {
  const user = {
    id: 'user-1',
    email: 'ada@example.com',
    passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
    role: options.role ?? 'user',
    emailVerified: true,
    displayTimezone: 'Europe/Helsinki',
    sessionDefaultDuration: 30,
    sessionDefaultContentMix: 'balanced',
    sessionDefaultDifficulty: 'intermediate',
    sessionDefaultFocusArea: 'auto',
    sessionDefaultLearningStyle: 'weak-area-focus',
    deletedAt: null,
  }
  const em = {
    fork: vi.fn(),
    findOne: vi.fn(async () => user),
    count: vi.fn(async () => options.activeAdminCount ?? 2),
    flush: vi.fn(),
  }
  em.fork.mockReturnValue(em)
  const passwords = {
    verify: vi.fn(async () => options.passwordMatches ?? true),
  }
  const refreshTokens = {
    revokeAllForUser: vi.fn(),
  }

  return {
    em,
    passwords,
    refreshTokens,
    service: new UsersService(
      em as unknown as EntityManager,
      passwords as never,
      refreshTokens as never,
      new LastActiveAdminGuard(),
    ),
    user,
  }
}
