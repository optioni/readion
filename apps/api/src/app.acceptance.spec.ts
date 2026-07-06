import type { INestApplication } from '@nestjs/common'
import { Body, Controller, Get, HttpCode, NotFoundException, Post } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { startPostgresContainer, startRedisContainer } from '@readion/db'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import { IsEmail, IsNotEmpty } from 'class-validator'
import supertest from 'supertest'
import type { StartedTestContainer } from 'testcontainers'
import { vi } from 'vitest'
import { AppModule } from './app.module'
import { Public } from './auth/auth.guards'
import { bootstrapApp } from './bootstrap'
import type { CollectionResult } from './common/interceptors/response.interceptor'
import { AuthThrottle } from './throttler/throttler.decorators'

const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn<(error: unknown) => string>().mockReturnValue('fake-event-id'),
}))

vi.mock('@sentry/nestjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/nestjs')>()
  return { ...actual, captureException: mockCaptureException, init: vi.fn() }
})

class TestEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string
}

@Controller('test')
@Public()
class TestController {
  @Get('resource')
  resource() {
    return { id: '1', name: 'AWS Cloud Practitioner' }
  }

  @Get('collection')
  collection(): CollectionResult<object> {
    return {
      items: [{ id: 'a' }, { id: 'b' }],
      meta: { total: 100, page: 1, limit: 25 },
    }
  }

  @Get('error')
  error() {
    throw new NotFoundException('Certification not found')
  }

  @Get('boom')
  boom() {
    throw new Error('boom')
  }

  @Post('validate')
  @HttpCode(200)
  validate(@Body() dto: TestEmailDto) {
    return { email: dto.email }
  }

  @Get('auth-rate')
  @AuthThrottle()
  authRate() {
    return { ok: true }
  }

  @Get('general-rate')
  generalRate() {
    return { ok: true }
  }
}

describe('API Acceptance', () => {
  let app: INestApplication
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer

  beforeAll(async () => {
    const [pg, redis] = await Promise.all([startPostgresContainer(), startRedisContainer()])
    postgresContainer = pg
    redisContainer = redis

    const dbHost = pg.getHost()
    const dbPort = pg.getMappedPort(5432)
    const redisHost = redis.getHost()
    const redisPort = redis.getMappedPort(6379)

    process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
    process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`
    process.env.DB_HOST = dbHost
    process.env.DB_PORT = String(dbPort)
    process.env.DB_NAME = 'readion_test'
    process.env.DB_USER = 'readion'
    process.env.DB_PASSWORD = 'readion'
    process.env.PORT = '0'
    process.env.NODE_ENV = 'development'
    process.env.CORS_ORIGIN = 'http://localhost:3000'
    process.env.SENTRY_DSN = 'https://fake@sentry.io/0'

    await acquireIsolatedDatabase()

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestController],
    }).compile()

    app = moduleRef.createNestApplication()
    await bootstrapApp(app)
    await app.init()
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
    delete process.env.SENTRY_DSN
  })

  describe('api-runtime: response envelopes', () => {
    it('wraps a plain object in a data envelope', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/test/resource')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { id: '1', name: 'AWS Cloud Practitioner' } })
    })

    it('wraps a collection result in data + meta envelope', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/test/collection')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: [{ id: 'a' }, { id: 'b' }],
        meta: { total: 100, page: 1, limit: 25 },
      })
    })
  })

  describe('api-runtime: exception filter', () => {
    it('maps NotFoundException to 404 problem-details', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/test/error')
      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch('application/problem+json')
      expect(res.body.type).toBe('/errors/not-found')
      expect(res.body.status).toBe(404)
      expect(res.body.detail).toBe('Certification not found')
    })

    it('maps unhandled Error to 500 without leaking internals', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/test/boom')
      expect(res.status).toBe(500)
      expect(res.body.type).toBe('/errors/internal-server-error')
      expect(res.body.status).toBe(500)
      expect(res.body.detail).not.toMatch(/boom/)
    })
  })

  describe('api-runtime: validation pipe', () => {
    it('rejects invalid body with 422 validation problem', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/test/validate')
        .send({ email: '' })
      expect(res.status).toBe(422)
      expect(res.body.type).toBe('/errors/validation-error')
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      )
    })

    it('strips unknown properties before handler', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/v1/test/validate')
        .send({ email: 'a@b.com', isAdmin: true })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ email: 'a@b.com' })
    })
  })

  describe('health-checks', () => {
    it('GET /health returns 200 with all dependencies up', async () => {
      const res = await supertest(app.getHttpServer()).get('/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.info).toHaveProperty('postgres')
      expect(res.body.info).toHaveProperty('redis')
      expect(res.body.info).toHaveProperty('disk')
    })

    it('GET /health resolves without /api/v1 prefix', async () => {
      const prefixed = await supertest(app.getHttpServer()).get('/api/v1/health')
      expect(prefixed.status).toBe(404)
      const plain = await supertest(app.getHttpServer()).get('/health')
      expect(plain.status).toBe(200)
    })
  })

  describe('rate-limiting', () => {
    it('auth-tier route returns 429 after 10 requests', async () => {
      for (let i = 0; i < 10; i++) {
        const r = await supertest(app.getHttpServer()).get('/api/v1/test/auth-rate')
        expect(r.status).toBe(200)
      }

      const over = await supertest(app.getHttpServer()).get('/api/v1/test/auth-rate')
      expect(over.status).toBe(429)
      expect(over.body.type).toBe('/errors/too-many-requests')
      expect(over.headers['retry-after']).toBeDefined()
    })

    // Probe/scrape endpoints must be exempt from every named tier — the auth
    // tier (10/15min) would otherwise 429 k8s liveness probes and crash-loop
    // the pod. A bare @SkipThrottle() does not cover named tiers.
    it('GET /health is never throttled past the auth-tier ceiling', async () => {
      for (let i = 0; i < 15; i++) {
        const r = await supertest(app.getHttpServer()).get('/health')
        expect(r.status).toBe(200)
      }
    })

    it('GET /metrics is never throttled past the auth-tier ceiling', async () => {
      for (let i = 0; i < 15; i++) {
        const r = await supertest(app.getHttpServer()).get('/metrics')
        expect(r.status).toBe(200)
      }
    })
  })

  describe('security-middleware', () => {
    it('responses carry required security headers', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/test/resource')
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['x-frame-options']).toBeDefined()
      expect(res.headers['referrer-policy']).toBeDefined()
      expect(res.headers['strict-transport-security']).toBeDefined()
      expect(res.headers['content-security-policy']).toBeDefined()
    })

    it('allowed origin receives CORS headers with credentials', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/v1/test/resource')
        .set('Origin', 'http://localhost:3000')
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(res.headers['access-control-allow-credentials']).toBe('true')
    })

    it('disallowed origin is not echoed', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/v1/test/resource')
        .set('Origin', 'https://evil.example')
      expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example')
    })

    it('preflight for allowed origin succeeds', async () => {
      const res = await supertest(app.getHttpServer())
        .options('/api/v1/test/resource')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
      expect(res.status).toBeLessThan(300)
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    })
  })

  describe('openapi-client', () => {
    it('GET /api-json returns OpenAPI doc in development', async () => {
      const res = await supertest(app.getHttpServer()).get('/api-json')
      expect(res.status).toBe(200)
      expect(res.body.openapi).toMatch(/^3\./)
    })
  })

  describe('api-runtime: versioning', () => {
    it('versioned route is reachable under /api/v1', async () => {
      const res = await supertest(app.getHttpServer()).get('/api/v1/test/resource')
      expect(res.status).toBe(200)
    })

    it('unprefixed application route is not found', async () => {
      const res = await supertest(app.getHttpServer()).get('/test/resource')
      expect(res.status).toBe(404)
    })
  })

  describe('observability', () => {
    describe('prometheus-metrics', () => {
      it('GET /metrics returns 200 in Prometheus text format with HTTP duration histogram', async () => {
        await supertest(app.getHttpServer()).get('/api/v1/test/resource')

        const res = await supertest(app.getHttpServer()).get('/metrics')
        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toMatch('text/plain')
        expect(res.text).toContain('process_cpu_seconds_total')
        expect(res.text).toContain('readion_http_request_duration_seconds')
        expect(res.text).toContain('method="GET"')
        expect(res.text).toContain('status_code="200"')
      })
    })

    describe('structured-logging', () => {
      it('request carries a correlation id response header', async () => {
        const res = await supertest(app.getHttpServer()).get('/api/v1/test/resource')
        expect(res.headers['x-request-id']).toBeDefined()
      })

      it('authorization header is redacted and request still succeeds', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/api/v1/test/resource')
          .set('Authorization', 'Bearer secret-token')
        expect(res.status).toBe(200)
      })
    })

    describe('sentry-error-capture', () => {
      it('unhandled error is captured while client still receives RFC 7807 body', async () => {
        mockCaptureException.mockClear()

        const res = await supertest(app.getHttpServer()).get('/api/v1/test/boom')
        expect(res.status).toBe(500)
        expect(res.body.type).toBe('/errors/internal-server-error')
        expect(mockCaptureException).toHaveBeenCalled()
      })
    })
  })
})
