import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type AuthUser,
  authSessionResponseSchema,
  authUserSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  passwordResetRequestSchema,
  Role,
  type RoleValue,
  refreshResponseSchema,
  registerRequestSchema,
  roles,
} from './index'

describe('auth shared contracts', () => {
  it('exports the two supported roles as literals', () => {
    expect(Role.User).toBe('user')
    expect(Role.Admin).toBe('admin')
    expect(roles).toEqual(['user', 'admin'])
    expectTypeOf<RoleValue>().toEqualTypeOf<'user' | 'admin'>()
  })

  it('validates register and login request DTOs', () => {
    expect(
      registerRequestSchema.parse({ email: 'ada@example.com', password: 'correcthorse' }),
    ).toEqual({
      email: 'ada@example.com',
      password: 'correcthorse',
    })
    expect(
      registerRequestSchema.safeParse({ email: 'ada@example.com', password: 'short' }).success,
    ).toBe(false)
    expect(
      loginRequestSchema.safeParse({ email: 'not-an-email', password: 'correcthorse' }).success,
    ).toBe(false)
  })

  it('validates forgot and reset password payloads', () => {
    expect(forgotPasswordRequestSchema.parse({ email: 'ada@example.com' })).toEqual({
      email: 'ada@example.com',
    })
    expect(
      passwordResetRequestSchema.parse({ token: 'reset-token', password: 'correcthorse' }),
    ).toEqual({
      token: 'reset-token',
      password: 'correcthorse',
    })
    expect(passwordResetRequestSchema.safeParse({ token: '', password: 'short' }).success).toBe(
      false,
    )
  })

  it('models auth user responses without password fields', () => {
    const user = authUserSchema.parse({
      id: 'user-1',
      email: 'ada@example.com',
      role: 'admin',
      emailVerified: false,
    })

    expect(user).not.toHaveProperty('password')
    expect(user).not.toHaveProperty('passwordHash')
    expectTypeOf<AuthUser>().not.toHaveProperty('password')
    expectTypeOf<AuthUser>().not.toHaveProperty('passwordHash')
  })

  it('models refresh responses with access tokens only', () => {
    const session = authSessionResponseSchema.parse({
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        role: 'admin',
        emailVerified: true,
      },
      accessToken: 'access-token',
    })
    const response = refreshResponseSchema.parse({ accessToken: 'access-token' })

    expect(session.accessToken).toBe('access-token')
    expect(session.user).not.toHaveProperty('password')
    expect(session).not.toHaveProperty('refreshToken')
    expect(response).toEqual({ accessToken: 'access-token' })
    expect(response).not.toHaveProperty('refreshToken')
  })
})
