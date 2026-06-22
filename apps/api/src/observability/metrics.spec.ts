import type { INestApplication } from '@nestjs/common'
import { Controller, Get } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { InjectMetric, makeCounterProvider } from '@willsoto/nestjs-prometheus'
import { Counter } from 'prom-client'
import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootstrapApp } from '../bootstrap'
import { parseEnv } from '../config/env.schema'
import { ApiObservabilityModule } from './observability.module'

@Controller('metrics-test')
class MetricsTestController {
  constructor(
    @InjectMetric('readion_test_events_total')
    private readonly counter: Counter,
  ) {}

  @Get('ping')
  ping() {
    return { ok: true }
  }

  @Get('increment')
  increment() {
    this.counter.inc()
    return { incremented: true }
  }

  @Get('boom')
  boom() {
    throw new Error('metrics-test-boom')
  }
}

describe('prometheus metrics integration', () => {
  let app: INestApplication

  beforeAll(async () => {
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
      controllers: [MetricsTestController],
      providers: [
        makeCounterProvider({
          name: 'readion_test_events_total',
          help: 'Test counter for integration tests',
        }),
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await bootstrapApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('GET /metrics returns 200 in Prometheus text format', async () => {
    const res = await supertest(app.getHttpServer()).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch('text/plain')
  })

  it('/metrics includes default Node.js process metrics', async () => {
    const res = await supertest(app.getHttpServer()).get('/metrics')
    expect(res.text).toContain('process_cpu_seconds_total')
    expect(res.text).toContain('nodejs_eventloop_lag_seconds')
  })

  it('/metrics includes HTTP request-duration histogram after a request', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/metrics-test/ping')
    const res = await supertest(app.getHttpServer()).get('/metrics')
    expect(res.text).toContain('readion_http_request_duration_seconds')
    expect(res.text).toContain('method="GET"')
    expect(res.text).toContain('status_code="200"')
  })

  it('/metrics uses a route template label (not raw req.url with query strings)', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/metrics-test/ping?foo=bar')
    const res = await supertest(app.getHttpServer()).get('/metrics')
    expect(res.text).toContain('route=')
    // The label must not include the query string
    expect(res.text).not.toContain('foo=bar')
  })

  it('a registered custom counter appears on /metrics after increment', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/metrics-test/increment')
    const res = await supertest(app.getHttpServer()).get('/metrics')
    expect(res.text).toContain('readion_test_events_total 1')
  })

  it('/metrics labels unhandled request errors with the final 500 status', async () => {
    await supertest(app.getHttpServer()).get('/api/v1/metrics-test/boom').expect(500)

    const res = await supertest(app.getHttpServer()).get('/metrics')
    expect(res.text).toContain('route="/api/v1/metrics-test/boom",status_code="500"')
    expect(res.text).not.toContain('route="/api/v1/metrics-test/boom",status_code="200"')
  })
})
