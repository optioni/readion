import type { DynamicModule } from '@nestjs/common'
import { Module } from '@nestjs/common'
import * as Sentry from '@sentry/nestjs'
import { PrometheusModule } from '@willsoto/nestjs-prometheus'
import { LoggerModule } from 'nestjs-pino'
import type { DestinationStream } from 'pino'
import { WorkerMetricsServer } from './worker-metrics.server'

interface ObservabilityOptions {
  stream?: DestinationStream
}

const REDACT_PATHS = ['*.password', '*.token', '*.secret']

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern requires a class
export class WorkerObservabilityModule {
  static forRoot(options: ObservabilityOptions = {}): DynamicModule {
    const level = process.env.LOG_LEVEL ?? 'info'

    if (process.env.SENTRY_DSN) {
      Sentry.init({ dsn: process.env.SENTRY_DSN, release: process.env.SENTRY_RELEASE })
    }

    const pinoConfig = {
      level,
      redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    }

    const pinoHttpCfg = options.stream
      ? ([pinoConfig, options.stream] as [object, DestinationStream])
      : pinoConfig

    return {
      module: WorkerObservabilityModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: pinoHttpCfg,
        }),
        PrometheusModule.register({
          global: true,
          defaultMetrics: { enabled: true },
        }),
      ],
      providers: [WorkerMetricsServer],
      exports: [LoggerModule, PrometheusModule],
    }
  }
}
