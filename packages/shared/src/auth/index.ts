import { z } from 'zod'

export const Role = {
  User: 'user',
  Admin: 'admin',
} as const

export const roles = [Role.User, Role.Admin] as const

export type RoleValue = (typeof roles)[number]

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  role: z.enum(roles),
  emailVerified: z.boolean(),
})

export const passwordSchema = z.string().min(8)

export const registerRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

export const loginRequestSchema = registerRequestSchema

export const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
})

export const authSessionResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
})

export const forgotPasswordRequestSchema = z.object({
  email: z.email(),
})

export const passwordResetRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

export type AuthUser = z.infer<typeof authUserSchema>
export type RegisterRequest = z.infer<typeof registerRequestSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type RefreshResponse = z.infer<typeof refreshResponseSchema>
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>
