import 'reflect-metadata'
import { parseEnv } from './config/env.schema'
import { loadApiEnvFile } from './config/env-file'
import { initTracing } from './tracing'

async function bootstrap() {
  loadApiEnvFile()
  const env = parseEnv(process.env)
  initTracing({ endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT })

  const [{ NestFactory }, { Logger }, { AppModule }, { bootstrapApp }] = await Promise.all([
    import('@nestjs/core'),
    import('nestjs-pino'),
    import('./app.module'),
    import('./bootstrap'),
  ])

  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  await bootstrapApp(app)
  const port = process.env.PORT ?? 3001
  await app.listen(port)
}

bootstrap()
