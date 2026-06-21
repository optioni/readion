import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { HealthIndicatorResult } from '@nestjs/terminus'
import { HealthIndicatorService } from '@nestjs/terminus'

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key)
    try {
      const em = this.moduleRef.get(EntityManager, { strict: false })
      await em.getConnection().execute('SELECT 1')
      return indicator.up()
    } catch {
      return indicator.down({ message: 'database unreachable' })
    }
  }
}
