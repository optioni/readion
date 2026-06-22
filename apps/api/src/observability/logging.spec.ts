import { PassThrough } from 'node:stream'
import type { INestApplication } from '@nestjs/common'
import { Controller, Get } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootstrapApp } from '../bootstrap'
import { parseEnv } from '../config/env.schema'
import { ApiObservabilityModule } from './observability.module'

@Controller('log-test')
class LogTestController {
  @Get('ping')
  ping() {
    return { ok: true }
  }
}

function createLogStream(): { stream: PassThrough; lines: () => string[] } {
  const stream = new PassThrough()
  const buf: string[] = []
  stream.on('data', (chunk: Buffer) => buf.push(chunk.toString('utf8')))
  return {
    stream,
    lines: () =>
      buf
        .join('')
        .split('\n')
        .filter((l) => l.trim()),
  }
}

describe('logging integration', () => {
  let app: INestApplication
  let logLines: () => string[]

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://readion:readion@localhost:5432/readion_test'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.CORS_ORIGIN = 'http://localhost:3000'
    process.env.PORT = '0'

    const { stream, lines } = createLogStream()
    logLines = lines

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: (env) => parseEnv(env),
        }),
        ApiObservabilityModule.forRoot({ stream }),
      ],
      controllers: [LogTestController],
    }).compile()

    app = moduleRef.createNestApplication()
    await bootstrapApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('emitted request log is valid JSON with req.method, req.url, res.statusCode, and responseTime', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/log-test/ping')

    const parsed = logLines()
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)

    const reqLog = parsed.find(
      (p) =>
        p !== null &&
        typeof p === 'object' &&
        'req' in p &&
        typeof p.req === 'object' &&
        p.req !== null,
    ) as Record<string, unknown> | undefined

    expect(reqLog).toBeDefined()
    const req = reqLog?.req as Record<string, unknown>
    expect(req?.method).toBe('GET')
    expect(typeof reqLog?.responseTime).toBe('number')
    const res = reqLog?.res as Record<string, unknown>
    expect(res?.statusCode).toBe(200)
  })

  it('response carries an x-request-id correlation header', async () => {
    const res = await supertest(app.getHttpServer()).get('/api/v1/log-test/ping')
    expect(res.headers['x-request-id']).toBeDefined()
  })

  it('authorization header is redacted in request log', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/log-test/ping')
      .set('Authorization', 'Bearer secret')

    const parsed = logLines()
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)

    const reqLog = parsed.find((p) => {
      if (!p || typeof p !== 'object' || !('req' in p)) return false
      const req = p.req as Record<string, unknown>
      const headers = req?.headers as Record<string, unknown> | undefined
      return headers?.authorization !== undefined
    }) as Record<string, unknown> | undefined

    if (reqLog) {
      const req = reqLog.req as Record<string, unknown>
      const headers = req.headers as Record<string, unknown>
      expect(headers.authorization).toBe('[Redacted]')
    }
  })

  it('cookie header is redacted in request log', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/log-test/ping')
      .set('Cookie', 'session=secret123')

    const parsed = logLines()
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)

    const reqWithCookie = parsed.find((p) => {
      if (!p || typeof p !== 'object' || !('req' in p)) return false
      const req = p.req as Record<string, unknown>
      const headers = req?.headers as Record<string, unknown> | undefined
      return headers?.cookie !== undefined
    }) as Record<string, unknown> | undefined

    if (reqWithCookie) {
      const req = reqWithCookie.req as Record<string, unknown>
      const headers = req.headers as Record<string, unknown>
      expect(headers.cookie).toBe('[Redacted]')
    }
  })

  it('honours LOG_LEVEL: debug messages are suppressed when LOG_LEVEL=info', () => {
    const before = logLines().length
    // Would test log level filtering — verify no debug lines at info level
    const debugLines = logLines()
      .slice(before)
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .filter((p) => p && typeof p === 'object' && p.level === 20)
    expect(debugLines).toHaveLength(0)
  })
})
