import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { ContentSource } from '@readion/db'
import type { ContentSourceType } from '@readion/shared'

@Injectable()
export class ContentSourceRepository {
  constructor(private readonly em: EntityManager) {}

  findById(id: string): Promise<ContentSource | null> {
    return this.em.fork().findOne(ContentSource, { id })
  }

  async findStaleForReingestion(now: Date): Promise<ContentSource[]> {
    const rows = await this.em.getConnection().execute<{ id: string }[]>(
      `
      SELECT id FROM content_sources
      WHERE enabled = true
        AND (
          last_fetched_at IS NULL
          OR last_fetched_at + (recheck_interval_minutes * interval '1 minute') < ?
        )
      `,
      [now.toISOString()],
    )

    if (rows.length === 0) return []

    const ids = rows.map((r: { id: string }) => r.id)
    return this.em.fork().find(ContentSource, { id: { $in: ids } })
  }

  async updateLastFetchedAt(id: string, fetchedAt: Date): Promise<void> {
    await this.em
      .getConnection()
      .execute('UPDATE content_sources SET last_fetched_at = ?, updated_at = NOW() WHERE id = ?', [
        fetchedAt.toISOString(),
        id,
      ])
  }

  async create(data: {
    certificationId: string
    type: ContentSourceType
    url: string
    recheckIntervalMinutes?: number
  }): Promise<ContentSource> {
    const { SOURCE_RECHECK_INTERVALS } = await import('@readion/shared')
    const em = this.em.fork()
    const source = em.create(ContentSource, {
      certificationId: data.certificationId,
      type: data.type,
      url: data.url,
      recheckIntervalMinutes: data.recheckIntervalMinutes ?? SOURCE_RECHECK_INTERVALS[data.type],
    })
    em.persist(source)
    await em.flush()
    return source
  }
}
