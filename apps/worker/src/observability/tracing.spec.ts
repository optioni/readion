import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base'
import { afterEach, describe, expect, it } from 'vitest'
import { initTracing, shutdownTracing } from '../tracing'

describe('worker tracing bootstrap', () => {
  afterEach(async () => {
    await shutdownTracing()
  })

  it('no-op branch: boots without exporter or endpoint', async () => {
    initTracing()
    await expect(shutdownTracing()).resolves.toBeUndefined()
  })

  it('exporter branch: accepts an in-memory span exporter', async () => {
    const exporter = new InMemorySpanExporter()
    initTracing({ exporter })
    await expect(shutdownTracing()).resolves.toBeUndefined()
  })

  it('endpoint branch: accepts an OTLP endpoint URL', async () => {
    initTracing({ endpoint: 'http://localhost:4318' })
    await expect(shutdownTracing()).resolves.toBeUndefined()
  })

  it('guard: subsequent initTracing call while SDK is active is a no-op', async () => {
    const first = new InMemorySpanExporter()
    const second = new InMemorySpanExporter()
    initTracing({ exporter: first })
    initTracing({ exporter: second })
    await expect(shutdownTracing()).resolves.toBeUndefined()
  })

  it('shutdownTracing with no SDK resolves immediately', async () => {
    await shutdownTracing()
    await expect(shutdownTracing()).resolves.toBeUndefined()
  })
})
