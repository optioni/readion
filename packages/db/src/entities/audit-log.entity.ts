import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { AuditActionValue } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const AuditLogSchema = defineEntity({
  name: 'AuditLog',
  tableName: 'audit_logs',
  extends: BaseSchema,
  properties: {
    userId: p.uuid().nullable(),
    action: p.string(),
    targetType: p.string(),
    targetId: p.string(),
    before: p.json<Record<string, unknown>>().nullable(),
    after: p.json<Record<string, unknown>>().nullable(),
  },
})

export class AuditLog extends AuditLogSchema.class {
  [OptionalProps]?: 'userId' | 'before' | 'after'

  override id: string = v4()
  override userId: string | null = null
  override action!: AuditActionValue
  override targetType!: string
  override targetId!: string
  override before: Record<string, unknown> | null = null
  override after: Record<string, unknown> | null = null
}

AuditLogSchema.setClass(AuditLog)
