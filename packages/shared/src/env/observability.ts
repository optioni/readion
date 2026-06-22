import { z } from 'zod'
import { zodCoerceNumber, zodRequiredUrl } from './helpers'

const PINO_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

export const observabilityEnvFragment = {
  LOG_LEVEL: z.enum(PINO_LEVELS).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: zodRequiredUrl().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SERVICE_NAME: z.string().default('readion'),
}

export const workerPrometheusFragment = {
  PROMETHEUS_PORT: zodCoerceNumber().default(9091),
}
