import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CoverageStats } from '@readion/db'
import { Certification } from '@readion/db'
import type { CertificationState, CoverageEvaluation } from '@readion/shared'
import {
  DEFAULT_MIN_CHUNKS_PER_DOMAIN,
  DEFAULT_TOTAL_CHUNK_MULTIPLE,
  evaluateCoverage,
} from '@readion/shared'
import type { EnvConfig } from '../config/env.schema'

export type CoverageStatsQuery = (
  em: EntityManager,
  certificationId: string,
) => Promise<CoverageStats>

export const COVERAGE_STATS_QUERY = 'COVERAGE_STATS_QUERY'

export interface CoverageReport extends CoverageEvaluation {
  state: CertificationState
}

@Injectable()
export class CertificationCoverageService {
  constructor(
    private readonly em: EntityManager,
    @Inject(COVERAGE_STATS_QUERY) private readonly queryStats: CoverageStatsQuery,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async getCoverageReport(certificationId: string): Promise<CoverageReport> {
    const em = this.em.fork()
    const cert = await em.findOne(Certification, { id: certificationId })

    if (!cert) {
      throw new NotFoundException('Certification not found')
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

    return { ...evaluation, state: cert.state }
  }
}
