import { PassThrough } from 'node:stream'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Logger } from 'nestjs-pino'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseEnv } from '../config/env.schema'
import { WorkerObservabilityModule } from './observability.module'

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

@Module({})
class MinimalAppModule {}

describe('worker logging integration', () => {
  let moduleRef: TestingModule
  let logLines: () => string[]

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://readion:readion@localhost:5432/readion_test'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.SCRAPPER_URL = 'http://localhost:3001'
    process.env.PROMETHEUS_PORT = '0'

    const { stream, lines } = createLogStream()
    logLines = lines

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: (env) => parseEnv(env),
        }),
        WorkerObservabilityModule.forRoot({ stream }),
        MinimalAppModule,
      ],
    }).compile()

    await moduleRef.init()
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  it('worker logger emits single-line JSON to the configured stream', () => {
    const logger = moduleRef.get(Logger)
    logger.log('worker-log-test-message')

    const parsed = logLines()
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)

    expect(parsed.length).toBeGreaterThan(0)
    const logEntry = parsed.find(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof p.msg === 'string' &&
        p.msg.includes('worker-log-test-message'),
    )
    expect(logEntry).toBeDefined()
  })

  it('worker logger output has level and time fields', () => {
    const logger = moduleRef.get(Logger)
    logger.log('worker-log-fields-test')

    const parsed = logLines()
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)

    const entry = parsed.find(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof p.msg === 'string' &&
        p.msg.includes('worker-log-fields-test'),
    )
    expect(entry).toBeDefined()
    expect(typeof entry?.level).toBe('number')
    expect(typeof entry?.time).toBe('number')
  })
})
