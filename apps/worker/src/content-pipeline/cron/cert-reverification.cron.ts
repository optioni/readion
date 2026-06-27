import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Certification } from '@readion/db'
import { CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT, dueForReverification } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import type { WorkerEnvConfig } from '../../config/env.schema'

export const CERT_REVERIFICATION_CRON = 'cert-reverification-surfacing'
export const CERTS_DUE_FOR_REVERIFICATION_GAUGE = 'readion_certs_due_for_reverification'

@Injectable()
export class CertReverificationCron {
  private readonly logger = new Logger(CertReverificationCron.name)

  constructor(
    private readonly em: EntityManager,
    @InjectMetric(CERTS_DUE_FOR_REVERIFICATION_GAUGE) private readonly dueGauge: Gauge,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: CERT_REVERIFICATION_CRON })
  async surfaceDueCertifications(now = new Date()): Promise<void> {
    const intervalDays =
      this.config.get('CERT_REVERIFICATION_INTERVAL_DAYS') ??
      CERT_REVERIFICATION_INTERVAL_DAYS_DEFAULT

    const certs = await this.em
      .fork()
      .find(Certification, {}, { fields: ['id', 'code', 'verifiedAt'] })
    const due = certs.filter((cert) => dueForReverification(cert.verifiedAt, now, intervalDays))

    this.dueGauge.set(due.length)
    this.logger.log(
      `${due.length} certification(s) due for re-verification: ${due
        .map((cert) => `${cert.code} (${cert.id})`)
        .join(', ')}`,
    )
  }
}
