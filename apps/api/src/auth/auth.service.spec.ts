import { UnauthorizedException } from '@nestjs/common'
import { User } from '@readion/db'
import { describe, expect, it, vi } from 'vitest'
import { AuthService, isRegistrationAllowed } from './auth.service'

describe('isRegistrationAllowed', () => {
  it('allows registration when signups are enabled', () => {
    expect(isRegistrationAllowed(true, 5)).toBe(true)
    expect(isRegistrationAllowed(true, 0)).toBe(true)
  })

  it('blocks registration when signups are disabled and users already exist', () => {
    expect(isRegistrationAllowed(false, 1)).toBe(false)
    expect(isRegistrationAllowed(false, 42)).toBe(false)
  })

  it('allows the bootstrap first user even when signups are disabled', () => {
    expect(isRegistrationAllowed(false, 0)).toBe(true)
  })
})

function buildService(user: User | null) {
  const em = {
    findOne: vi.fn().mockResolvedValue(user),
    flush: vi.fn().mockResolvedValue(undefined),
  }
  const emFactory = { fork: vi.fn().mockReturnValue(em) }
  const passwords = {
    hash: vi.fn().mockResolvedValue('new-hash'),
    verify: vi.fn(),
  }
  const accessTokens = { issue: vi.fn().mockResolvedValue('access-token') }
  const refreshTokens = {
    issue: vi.fn().mockResolvedValue({ token: 'refresh-token', userId: 'user-1' }),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  }

  const service = new AuthService(
    emFactory as never,
    passwords as never,
    accessTokens as never,
    refreshTokens as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  )

  return { service, em, passwords, accessTokens, refreshTokens }
}

describe('AuthService.changePassword', () => {
  it('rejects a wrong current password without mutating anything', async () => {
    const user = { id: 'user-1', role: 'user', passwordHash: 'old-hash' } as unknown as User
    const { service, em, passwords, refreshTokens } = buildService(user)
    passwords.verify.mockResolvedValue(false)

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'wrong',
        newPassword: 'new-strong-pass',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(passwords.verify).toHaveBeenCalledWith('wrong', 'old-hash')
    expect(passwords.hash).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled()
    expect(refreshTokens.issue).not.toHaveBeenCalled()
    expect(user.passwordHash).toBe('old-hash')
  })

  it('hashes, persists, then revokes all tokens and issues a fresh session in order', async () => {
    const user = { id: 'user-1', role: 'user', passwordHash: 'old-hash' } as unknown as User
    const { service, em, passwords, accessTokens, refreshTokens } = buildService(user)
    passwords.verify.mockResolvedValue(true)

    const result = await service.changePassword('user-1', {
      currentPassword: 'old-strong-pass',
      newPassword: 'new-strong-pass',
    })

    expect(passwords.hash).toHaveBeenCalledWith('new-strong-pass')
    expect(user.passwordHash).toBe('new-hash')
    expect(em.flush).toHaveBeenCalledTimes(1)
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1')
    expect(refreshTokens.issue).toHaveBeenCalledWith('user-1')

    const flushOrder = em.flush.mock.invocationCallOrder[0]
    const revokeOrder = refreshTokens.revokeAllForUser.mock.invocationCallOrder[0]
    const issueOrder = refreshTokens.issue.mock.invocationCallOrder[0]
    expect(flushOrder).toBeLessThan(revokeOrder)
    expect(revokeOrder).toBeLessThan(issueOrder)

    expect(accessTokens.issue).toHaveBeenCalledWith({ userId: 'user-1', role: 'user' })
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' })
  })

  it('rejects when the user no longer exists', async () => {
    const { service, passwords } = buildService(null)

    await expect(
      service.changePassword('missing', {
        currentPassword: 'whatever',
        newPassword: 'new-strong-pass',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(passwords.verify).not.toHaveBeenCalled()
  })
})
