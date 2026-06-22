import * as net from 'node:net'
import { Injectable } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { InjectMetric, makeCounterProvider } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseEnv } from '../config/env.schema'
import { WorkerObservabilityModule } from './observability.module'

async function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

@Injectable()
class TestMetricEmitter {
  constructor(
    @InjectMetric('readion_worker_test_events_total')
    private readonly counter: Counter,
  ) {}

  increment(): void {
    this.counter.inc()
  }
}

describe('worker prometheus metrics integration', () => {
  let moduleRef: TestingModule
  let prometheusPort: number

  beforeAll(async () => {
    prometheusPort = await getFreePort()

    process.env.DATABASE_URL = 'postgresql://readion:readion@localhost:5432/readion_test'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.SCRAPPER_URL = 'http://localhost:3001'
    process.env.PROMETHEUS_PORT = String(prometheusPort)

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: (env) => parseEnv(env),
        }),
        WorkerObservabilityModule.forRoot(),
      ],
      providers: [
        TestMetricEmitter,
        makeCounterProvider({
          name: 'readion_worker_test_events_total',
          help: 'Worker test counter for integration tests',
        }),
      ],
    }).compile()

    await moduleRef.init()
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  it('GET /metrics on PROMETHEUS_PORT returns 200 in Prometheus text format', async () => {
    const res = await fetch(`http://127.0.0.1:${prometheusPort}/metrics`)
    expect(res.status).toBe(200)
    const contentType = res.headers.get('content-type') ?? ''
    expect(contentType).toContain('text/plain')
  })

  it('returns 404 for non-metrics requests on PROMETHEUS_PORT', async () => {
    const res = await fetch(`http://127.0.0.1:${prometheusPort}/not-metrics`)
    expect(res.status).toBe(404)
    await expect(res.text()).resolves.toBe('Not found')
  })

  it('worker /metrics includes default Node.js process metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${prometheusPort}/metrics`)
    const text = await res.text()
    expect(text).toContain('process_cpu_seconds_total')
    expect(text).toContain('nodejs_eventloop_lag_seconds')
  })

  it('registered worker custom counters are injectable and exposed on /metrics', async () => {
    moduleRef.get(TestMetricEmitter).increment()

    const res = await fetch(`http://127.0.0.1:${prometheusPort}/metrics`)
    const text = await res.text()
    expect(text).toContain('readion_worker_test_events_total 1')
  })
})
