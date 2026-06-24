import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { User } from '@readion/db'
import type { WorkerEnvConfig } from '../config/env.schema'

const DAY_MS = 24 * 60 * 60 * 1000
export const USER_HARD_PURGE_CRON = 'user-hard-purge'

// Future user-owned features add their tables here; missing tables/columns are skipped.
const USER_SCOPED_TABLES = [
  ['agent_messages', 'user_id'],
  ['agent_conversations', 'user_id'],
  ['quiz_responses', 'user_id'],
  ['session_items', 'user_id'],
  ['study_sessions', 'user_id'],
  ['mock_exams', 'user_id'],
  ['weak_areas', 'user_id'],
  ['review_items', 'user_id'],
  ['user_certifications', 'user_id'],
] as const

export function purgeCutoff(now: Date, graceDays: number) {
  return new Date(now.getTime() - graceDays * DAY_MS)
}

export function isEligibleForHardPurge(deletedAt: Date | null, now: Date, graceDays: number) {
  return deletedAt !== null && deletedAt < purgeCutoff(now, graceDays)
}

@Injectable()
export class UserPurgeService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: USER_HARD_PURGE_CRON })
  async purgeEligibleDeletedUsers(now = new Date()) {
    const em = this.em.fork()
    const users = await this.findEligibleDeletedUsers(em, now)

    for (const user of users) {
      await this.hardPurgeUser(em, user)
    }
  }

  findEligibleDeletedUsers(em: EntityManager, now = new Date()) {
    const graceDays = this.config.get('LIFECYCLE_DELETION_GRACE_DAYS') ?? 14
    return em.find(User, { deletedAt: { $lt: purgeCutoff(now, graceDays) } })
  }

  private async hardPurgeUser(em: EntityManager, user: User) {
    await em.transactional(async (tx) => {
      await this.stripAuditIdentifiers(tx, user.id)

      for (const [table, column] of USER_SCOPED_TABLES) {
        await deleteByColumnIfPresent(tx, table, column, user.id)
      }

      tx.remove(user)
    })
  }

  private async stripAuditIdentifiers(em: EntityManager, userId: string) {
    if (!(await hasColumn(em, 'audit_logs', 'user_id'))) {
      return
    }

    await em
      .getConnection()
      .execute('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [userId])
  }
}

async function deleteByColumnIfPresent(
  em: EntityManager,
  tableName: string,
  columnName: string,
  value: string,
) {
  if (!(await hasColumn(em, tableName, columnName))) {
    return
  }

  await em.getConnection().execute(`DELETE FROM "${tableName}" WHERE "${columnName}" = ?`, [value])
}

async function hasColumn(em: EntityManager, tableName: string, columnName: string) {
  const rows = await em.getConnection().execute<{ exists: boolean }[]>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = ?
        AND column_name = ?
      ) AS "exists"
    `,
    [tableName, columnName],
  )

  return rows[0]?.exists === true
}
