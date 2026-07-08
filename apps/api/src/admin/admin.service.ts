import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { AuditLog, Certification, ContentSource, QuarantinedItem, User } from '@readion/db'
import {
  type AdminUserListItem,
  AuditAction,
  type AuditLogEntry,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  type RoleChangeResponse,
} from '@readion/shared'
import type { CollectionResult } from '../common/interceptors/response.interceptor'
import { LastActiveAdminGuard } from '../users/last-active-admin.guard'
import { AuditLogService } from './audit-log.service'
import { demoteTransition, promoteTransition } from './role-transition'

interface Pagination {
  page: number
  limit: number
  offset: number
}

function resolvePagination(page?: number, limit?: number): Pagination {
  const resolvedPage = page !== undefined && page > 0 ? Math.floor(page) : 1
  const requestedLimit = limit !== undefined && limit > 0 ? Math.floor(limit) : PAGE_SIZE_DEFAULT
  const resolvedLimit = Math.min(requestedLimit, PAGE_SIZE_MAX)
  return { page: resolvedPage, limit: resolvedLimit, offset: (resolvedPage - 1) * resolvedLimit }
}

@Injectable()
export class AdminService {
  constructor(
    private readonly em: EntityManager,
    private readonly lastActiveAdminGuard: LastActiveAdminGuard,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listUsers(page?: number, limit?: number): Promise<CollectionResult<AdminUserListItem>> {
    const { page: resolvedPage, limit: resolvedLimit, offset } = resolvePagination(page, limit)
    const em = this.em.fork()

    const [users, total] = await em.findAndCount(
      User,
      { deletedAt: null },
      { orderBy: { createdAt: 'DESC' }, limit: resolvedLimit, offset },
    )

    const counts = await this.enrollmentCounts(
      em,
      users.map((user) => user.id),
    )

    const items = users.map(
      (user): AdminUserListItem => ({
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
        enrollmentCount: counts.get(user.id) ?? 0,
      }),
    )

    return { items, meta: { total, page: resolvedPage, limit: resolvedLimit } }
  }

  async listAuditLogs(page?: number, limit?: number): Promise<CollectionResult<AuditLogEntry>> {
    const { page: resolvedPage, limit: resolvedLimit, offset } = resolvePagination(page, limit)
    const em = this.em.fork()

    const [logs, total] = await em.findAndCount(
      AuditLog,
      {},
      { orderBy: { createdAt: 'DESC' }, limit: resolvedLimit, offset },
    )

    const items = await this.mapAuditLogEntries(em, logs)

    return { items, meta: { total, page: resolvedPage, limit: resolvedLimit } }
  }

  async promote(actorUserId: string, targetId: string): Promise<RoleChangeResponse> {
    return this.em.fork().transactional(async (tx) => {
      const user = await tx.findOne(User, { id: targetId, deletedAt: null })

      if (user === null) {
        throw new NotFoundException('User not found')
      }

      const transition = promoteTransition(user.role)

      if (transition.changed) {
        const previousRole = user.role
        user.role = transition.role
        await this.auditLogService.record(
          {
            actorUserId,
            action: AuditAction.UserRolePromoted,
            targetType: 'user',
            targetId,
            before: { role: previousRole },
            after: { role: transition.role },
          },
          tx,
        )
      }

      return { id: user.id, role: user.role }
    })
  }

  async demote(actorUserId: string, targetId: string): Promise<RoleChangeResponse> {
    return this.em.fork().transactional(async (tx) => {
      const user = await tx.findOne(User, { id: targetId, deletedAt: null })

      if (user === null) {
        throw new NotFoundException('User not found')
      }

      const transition = demoteTransition(user.role)

      if (transition.changed) {
        const previousRole = user.role
        await this.lastActiveAdminGuard.assertCanDelete(user, tx)
        user.role = transition.role
        await this.auditLogService.record(
          {
            actorUserId,
            action: AuditAction.UserRoleDemoted,
            targetType: 'user',
            targetId,
            before: { role: previousRole },
            after: { role: transition.role },
          },
          tx,
        )
      }

      return { id: user.id, role: user.role }
    })
  }

  private async mapAuditLogEntries(em: EntityManager, logs: AuditLog[]): Promise<AuditLogEntry[]> {
    const userIds = new Set<string>()
    const certificationIds = new Set<string>()
    const contentSourceIds = new Set<string>()
    const quarantinedItemIds = new Set<string>()

    for (const log of logs) {
      if (log.userId !== null) {
        userIds.add(log.userId)
      }
      if (log.targetType === 'user') {
        userIds.add(log.targetId)
      } else if (log.targetType === 'Certification' || log.targetType === 'certification') {
        certificationIds.add(log.targetId)
      } else if (log.targetType === 'ContentSource') {
        contentSourceIds.add(log.targetId)
      } else if (log.targetType === 'quarantined_item') {
        quarantinedItemIds.add(log.targetId)
      }
    }

    const [users, certifications, contentSources, quarantinedItems] = await Promise.all([
      userIds.size > 0 ? em.find(User, { id: { $in: [...userIds] } }) : [],
      certificationIds.size > 0
        ? em.find(Certification, { id: { $in: [...certificationIds] } })
        : [],
      contentSourceIds.size > 0
        ? em.find(ContentSource, { id: { $in: [...contentSourceIds] } })
        : [],
      quarantinedItemIds.size > 0
        ? em.find(QuarantinedItem, { id: { $in: [...quarantinedItemIds] } })
        : [],
    ])

    const emailById = new Map(users.map((user) => [user.id, user.email]))
    const certificationNameById = new Map(certifications.map((cert) => [cert.id, cert.name]))
    const sourceLabelById = new Map(
      contentSources.map((source) => [source.id, `${source.type} · ${source.url}`]),
    )
    const quarantinedItemDomainById = new Map(
      quarantinedItems.map((item) => [item.id, item.domain]),
    )

    return logs.map(
      (log): AuditLogEntry => ({
        id: log.id,
        userId: log.userId,
        actorEmail: log.userId !== null ? (emailById.get(log.userId) ?? null) : null,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        targetLabel: this.resolveTargetLabel(
          log,
          emailById,
          certificationNameById,
          sourceLabelById,
          quarantinedItemDomainById,
        ),
        before: log.before,
        after: log.after,
        createdAt: log.createdAt.toISOString(),
      }),
    )
  }

  private resolveTargetLabel(
    log: AuditLog,
    emailById: Map<string, string>,
    certificationNameById: Map<string, string>,
    sourceLabelById: Map<string, string>,
    quarantinedItemDomainById: Map<string, string>,
  ): string {
    switch (log.targetType) {
      case 'user':
        return emailById.get(log.targetId) ?? log.targetId
      case 'Certification':
      case 'certification':
        return certificationNameById.get(log.targetId) ?? log.targetId
      case 'ContentSource':
        return sourceLabelById.get(log.targetId) ?? log.targetId
      case 'quarantined_item':
        return quarantinedItemDomainById.get(log.targetId) ?? log.targetId
      default:
        return log.targetId
    }
  }

  private async enrollmentCounts(
    em: EntityManager,
    userIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>()

    if (userIds.length === 0) {
      return counts
    }

    const placeholders = userIds.map(() => '?').join(', ')
    const rows = await em.getConnection().execute<{ user_id: string; count: number }[]>(
      `SELECT user_id, count(*)::int AS count
         FROM user_certifications
         WHERE status = ? AND user_id IN (${placeholders})
         GROUP BY user_id`,
      ['active', ...userIds],
    )

    for (const row of rows) {
      counts.set(row.user_id, row.count)
    }

    return counts
  }
}
