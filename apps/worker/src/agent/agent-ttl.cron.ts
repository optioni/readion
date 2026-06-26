import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Gauge } from 'prom-client'
import type { WorkerEnvConfig } from '../config/env.schema'

export const ACTIVE_STANDALONE_CONVERSATIONS_GAUGE = 'readion_active_standalone_conversations'

@Injectable()
export class AgentTtlCron {
  private readonly logger = new Logger(AgentTtlCron.name)

  constructor(
    private readonly em: EntityManager,
    @InjectMetric(ACTIVE_STANDALONE_CONVERSATIONS_GAUGE)
    private readonly activeStandaloneGauge: Gauge,
    private readonly config: ConfigService<WorkerEnvConfig>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupStaleStandaloneConversations(now = new Date()): Promise<void> {
    // stub for RED
    void now
    void this.em
    void this.config
    void this.activeStandaloneGauge
  }
}
