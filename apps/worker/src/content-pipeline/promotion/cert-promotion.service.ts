import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CoverageStats } from '@readion/db'
import { Certification } from '@readion/db'
import {
  DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  DEFAULT_TOTAL_CHUNK_MULTIPLE,
  evaluateCoverage,
} from '@readion/shared'
import type { WorkerEnvConfig } from '../../config/env.schema'

export type CoverageStatsQuery = (
  em: EntityManager,
  certificationId: string,
) => Promise<CoverageStats>

export const COVERAGE_STATS_QUERY = 'COVERAGE_STATS_QUERY'

@Injectable()
export class CertPromotionService {
  private readonly logger = new Logger(CertPromotionService.name)

  constructor(
    private readonly em: EntityManager,
    @Inject(COVERAGE_STATS_QUERY) private readonly queryStats: CoverageStatsQuery,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  async evaluateAndPromote(certificationId: string): Promise<void> {
    const em = this.em.fork()
    const cert = await em.findOne(Certification, { id: certificationId })

    if (!cert) {
      this.logger.warn(`Certification ${certificationId} not found during promotion check`)
      return
    }

    if (cert.state === 'live') {
      return
    }

    const thresholds = {
      minChunksPerDomain:
        this.config.get('CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN') ?? DEFAULT_MIN_CHUNKS_PER_DOMAIN,
      totalChunkMultiple:
        this.config.get('CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE') ?? DEFAULT_TOTAL_CHUNK_MULTIPLE,
    }

    const stats = await this.queryStats(em, certificationId)
    const domainNames = cert.domains.map((d) => d.name)
    const evaluation = evaluateCoverage(
      domainNames,
      stats.domains,
      stats.totalChunks,
      cert.questionCount,
      thresholds,
    )

    if (evaluation.met) {
      cert.state = 'live'
      await em.flush()
      this.logger.log(`Certification ${certificationId} promoted to live`)
    }
  }
}
