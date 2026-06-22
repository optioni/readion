import type { INestApplication } from '@nestjs/common'
import { Controller, Get } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { register } from 'prom-client'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapApp } from '../bootstrap'
import { parseEnv } from '../config/env.schema'
import { ApiObservabilityModule } from './observability.module'

// vi.hoisted ensures these are available when the mock factory runs (factories are hoisted)
const { mockCaptureException, mockInit } = vi.hoisted(() => ({
  mockCaptureException: vi.fn<(error: unknown) => string>().mockReturnValue('fake-event-id'),
  mockInit: vi.fn(),
}))

vi.mock('@sentry/nestjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/nestjs')>()
  return {
    ...actual,
    captureException: mockCaptureException,
    init: mockInit,
  }
})

@Controller('sentry-test')
class SentryTestController {
  @Get('boom')
  boom() {
    throw new Error('sentry-test-unhandled-error')
  }

  @Get('ok')
  ok() {
    return { ok: true }
  }
}

describe('sentry error reporting integration', () => {
  describe('with SENTRY_DSN configured', () => {
    let appWithDsn: INestApplication

    beforeAll(async () => {
      register.clear()
      process.env.DATABASE_URL = 'postgresql://readion:readion@localhost:5432/readion_test'
      process.env.REDIS_URL = 'redis://localhost:6379'
      process.env.CORS_ORIGIN = 'http://localhost:3000'
      process.env.PORT = '0'
      process.env.SENTRY_DSN = 'https://fake@sentry.io/0'
      process.env.SENTRY_RELEASE = 'test-release-sha'

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            validate: (env) => parseEnv(env),
          }),
          ApiObservabilityModule.forRoot(),
        ],
        controllers: [SentryTestController],
      }).compile()

      appWithDsn = moduleRef.createNestApplication()
      await bootstrapApp(appWithDsn)
      await appWithDsn.init()
    })

    afterAll(async () => {
      await appWithDsn?.close()
      delete process.env.SENTRY_DSN
      delete process.env.SENTRY_RELEASE
    })

    it('initializes Sentry with the runtime release for uploaded source maps', () => {
      expect(mockInit).toHaveBeenCalledWith({
        dsn: 'https://fake@sentry.io/0',
        release: 'test-release-sha',
      })
    })

    it('unhandled error is captured by Sentry while client receives RFC 7807 body', async () => {
      mockCaptureException.mockClear()

      const res = await supertest(appWithDsn.getHttpServer()).get('/api/v1/sentry-test/boom')
      expect(res.status).toBe(500)
      expect(res.body.type).toBe('/errors/internal-server-error')
      expect(mockCaptureException).toHaveBeenCalled()

      const [capturedError] = mockCaptureException.mock.calls[0] as [unknown]
      expect(capturedError).toBeInstanceOf(Error)
      expect((capturedError as Error).message).toBe('sentry-test-unhandled-error')
    })

    it('HttpExceptions are NOT reported to Sentry (only unhandled errors)', async () => {
      mockCaptureException.mockClear()
      const res = await supertest(appWithDsn.getHttpServer()).get('/api/v1/sentry-test/ok')
      expect(res.status).toBe(200)
      expect(mockCaptureException).not.toHaveBeenCalled()
    })
  })

  describe('without SENTRY_DSN', () => {
    let appNoDsn: INestApplication

    beforeAll(async () => {
      register.clear()
      delete process.env.SENTRY_DSN
      process.env.DATABASE_URL = 'postgresql://readion:readion@localhost:5432/readion_test'
      process.env.REDIS_URL = 'redis://localhost:6379'
      process.env.CORS_ORIGIN = 'http://localhost:3000'
      process.env.PORT = '0'

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            validate: (env) => parseEnv(env),
          }),
          ApiObservabilityModule.forRoot(),
        ],
        controllers: [SentryTestController],
      }).compile()

      appNoDsn = moduleRef.createNestApplication()
      await bootstrapApp(appNoDsn)
      await appNoDsn.init()
    })

    afterAll(async () => {
      await appNoDsn?.close()
    })

    it('app boots normally without SENTRY_DSN and serves requests', async () => {
      const res = await supertest(appNoDsn.getHttpServer()).get('/api/v1/sentry-test/ok')
      expect(res.status).toBe(200)
    })

    it('captureException is NOT called when SENTRY_DSN is absent', async () => {
      mockCaptureException.mockClear()
      await supertest(appNoDsn.getHttpServer()).get('/api/v1/sentry-test/boom')
      expect(mockCaptureException).not.toHaveBeenCalled()
    })
  })
})
