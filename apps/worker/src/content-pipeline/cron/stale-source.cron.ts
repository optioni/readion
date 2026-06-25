import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Certification } from '@readion/db'
import type { ContentSourceType } from '@readion/shared'
import { ContentQueuesService } from '../queues/content-queues.service'
import { ContentSourceRepository } from '../repository/content-source.repository'

export const STALE_SOURCE_CRON = 'stale-source-reingestion'

@Injectable()
export class StaleSourceCron {
  private readonly logger = new Logger(StaleSourceCron.name)

  constructor(
    private readonly sourceRepo: ContentSourceRepository,
    private readonly queuesService: ContentQueuesService,
    private readonly em: EntityManager,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: STALE_SOURCE_CRON })
  async enqueueStaleSourceJobs(now = new Date()): Promise<void> {
    const staleSources = await this.sourceRepo.findStaleForReingestion(now)
    this.logger.log(`Found ${staleSources.length} stale sources to re-ingest`)

    if (staleSources.length === 0) return

    const certIds = [...new Set(staleSources.map((s) => s.certificationId))]
    const certs = await this.em.fork().find(Certification, { id: { $in: certIds } })
    const domainsBycert = new Map(certs.map((c) => [c.id, c.domains.map((d) => d.name)]))

    for (const source of staleSources) {
      const domains = domainsBycert.get(source.certificationId) ?? []
      await this.queuesService.enqueue(source.id, source.type as ContentSourceType, domains)
    }
  }
}
