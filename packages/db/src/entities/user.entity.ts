import { defineEntity, p } from '@mikro-orm/core'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const UserRole = {
  User: 'user',
  Admin: 'admin',
} as const

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole]

export const UserSchema = defineEntity({
  name: 'User',
  tableName: 'users',
  extends: BaseSchema,
  properties: {
    email: p.string(),
    passwordHash: p.string(),
    emailVerified: p.boolean().default(false),
    role: p.enum([UserRole.User, UserRole.Admin]).default(UserRole.User),
  },
})

export class User extends UserSchema.class {
  id: string = v4()
  email!: string
  passwordHash!: string
  emailVerified: boolean = false
  role: UserRoleValue = UserRole.User
}

UserSchema.setClass(User)
