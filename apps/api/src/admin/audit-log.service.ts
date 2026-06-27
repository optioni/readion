import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { AuditLog } from '@readion/db'
import type { AuditActionValue } from '@readion/shared'

type AuditSnapshot = Record<string, unknown> | null

export interface RecordAuditInput {
  actorUserId: string | null
  action: AuditActionValue
  targetType: string
  targetId: string
  before?: AuditSnapshot
  after?: AuditSnapshot
}

@Injectable()
export class AuditLogService {
  constructor(private readonly em: EntityManager) {}

  async record(input: RecordAuditInput): Promise<AuditLog> {
    const em = this.em.fork()
    const entry = em.create(AuditLog, {
      userId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before ?? null,
      after: input.after ?? null,
    })
    em.persist(entry)
    await em.flush()
    return entry
  }
}
