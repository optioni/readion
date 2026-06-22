import 'reflect-metadata'
import { parseEnv } from './config/env.schema'
import { initTracing } from './tracing'

async function bootstrap() {
  const env = parseEnv(process.env)
  initTracing({ endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT })

  const [{ NestFactory }, { Logger }, { AppModule }] = await Promise.all([
    import('@nestjs/core'),
    import('nestjs-pino'),
    import('./app.module'),
  ])

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  app.enableShutdownHooks()
}

bootstrap()
