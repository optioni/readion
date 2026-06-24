import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DiskHealthIndicator, HealthCheck, HealthCheckService } from '@nestjs/terminus'
import { Public } from '../auth/auth.guards'
import { SkipEnvelope } from '../common/interceptors/response.interceptor'
import type { EnvConfig } from '../config/env.schema'
import { PostgresHealthIndicator } from './postgres-health.indicator'
import { RedisHealthIndicator } from './redis-health.indicator'

@Controller('health')
@SkipEnvelope()
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly disk: DiskHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly postgresIndicator: PostgresHealthIndicator,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const diskPath = this.config.get<string>('DISK_HEALTH_PATH') ?? '/'
    const diskThreshold = this.config.get<number>('DISK_HEALTH_THRESHOLD') ?? 0.9

    return this.health.check([
      () => this.postgresIndicator.isHealthy('postgres'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.disk.checkStorage('disk', { path: diskPath, thresholdPercent: diskThreshold }),
    ])
  }
}
