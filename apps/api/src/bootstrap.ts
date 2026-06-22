import type { INestApplication } from '@nestjs/common'
import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import { ProblemDetailsFilter } from './common/filters/problem-details.filter'
import { mapValidationErrors } from './common/validation/validation-errors'
import type { EnvConfig } from './config/env.schema'
import { buildOpenApiDocument, mountOpenApi } from './openapi/openapi.factory'

function buildCspOptions(corsOrigin: string) {
  return {
    directives: {
      defaultSrc: ["'self'", corsOrigin],
      connectSrc: ["'self'", corsOrigin],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
    },
  }
}

export async function bootstrapApp(app: INestApplication): Promise<void> {
  const config = app.get(ConfigService<EnvConfig>)
  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000'
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development'

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'api-json', 'metrics'] })

  app.use(
    helmet({
      contentSecurityPolicy: buildCspOptions(corsOrigin),
    }),
  )

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  })

  app.useGlobalFilters(new ProblemDetailsFilter())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: 422,
      exceptionFactory: (errors) =>
        new UnprocessableEntityException({ errors: mapValidationErrors(errors) }),
    }),
  )

  if (nodeEnv !== 'production') {
    const document = buildOpenApiDocument(app)
    mountOpenApi(app, document)
  }
}
