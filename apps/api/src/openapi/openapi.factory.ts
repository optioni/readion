import type { INestApplication } from '@nestjs/common'
import type { OpenAPIObject } from '@nestjs/swagger'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { APP_NAME, APP_VERSION } from '@readion/shared'

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle(APP_NAME).setVersion(APP_VERSION).build()
  return SwaggerModule.createDocument(app, config)
}

export function mountOpenApi(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup('api-docs', app, document)
  app.getHttpAdapter().get('/api-json', (_req: unknown, res: { json: (d: unknown) => void }) => {
    res.json(document)
  })
}
