import type { INestApplication } from '@nestjs/common'
import { Controller, Get } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from './openapi.factory'

@Controller('test')
class PingController {
  @Get('ping')
  ping() {
    return {}
  }
}

describe('buildOpenApiDocument', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PingController],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('returns a valid OpenAPI 3 document with title and version', () => {
    const doc = buildOpenApiDocument(app)
    expect(doc.openapi).toMatch(/^3\./)
    expect(doc.info.title).toBeTruthy()
    expect(doc.info.version).toBeTruthy()
  })
})
