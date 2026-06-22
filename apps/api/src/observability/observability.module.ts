import type { DynamicModule } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import type { SpanExporter } from '@opentelemetry/sdk-trace-base'
import * as Sentry from '@sentry/nestjs'
import { makeHistogramProvider, PrometheusModule } from '@willsoto/nestjs-prometheus'
import { LoggerModule } from 'nestjs-pino'
import type { DestinationStream } from 'pino'
import { initTracing } from '../tracing'
import { HTTP_REQUEST_DURATION_METRIC, HttpMetricsInterceptor } from './http-metrics.interceptor'
import { MetricsController } from './metrics.controller'
import { pinoHttpOptions } from './pino.options'

interface ObservabilityOptions {
  stream?: DestinationStream
  spanExporter?: SpanExporter
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern requires a class
export class ApiObservabilityModule {
  static forRoot(options: ObservabilityOptions = {}): DynamicModule {
    const level = process.env.LOG_LEVEL ?? 'info'

    initTracing({
      exporter: options.spanExporter,
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    })

    if (process.env.SENTRY_DSN) {
      Sentry.init({ dsn: process.env.SENTRY_DSN, release: process.env.SENTRY_RELEASE })
    }

    const pinoHttpCfg = options.stream
      ? ([{ ...pinoHttpOptions(), level }, options.stream] as [object, DestinationStream])
      : { ...pinoHttpOptions(), level }

    return {
      module: ApiObservabilityModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: pinoHttpCfg,
        }),
        PrometheusModule.register({
          global: true,
          defaultMetrics: { enabled: true },
          controller: MetricsController,
        }),
      ],
      providers: [
        makeHistogramProvider({
          name: HTTP_REQUEST_DURATION_METRIC,
          help: 'HTTP request duration in seconds',
          labelNames: ['method', 'route', 'status_code'],
          buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        }),
        {
          provide: APP_INTERCEPTOR,
          useClass: HttpMetricsInterceptor,
        },
      ],
      exports: [LoggerModule, PrometheusModule],
    }
  }
}
