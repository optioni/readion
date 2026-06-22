import { register } from 'prom-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerObservabilityModule } from './observability.module'

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}))

vi.mock('@sentry/nestjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/nestjs')>()
  return {
    ...actual,
    init: mockInit,
  }
})

describe('worker sentry initialization', () => {
  afterEach(() => {
    mockInit.mockClear()
    register.clear()
    delete process.env.SENTRY_DSN
    delete process.env.SENTRY_RELEASE
  })

  it('initializes Sentry with DSN and release when configured', () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/0'
    process.env.SENTRY_RELEASE = 'test-release-sha'

    WorkerObservabilityModule.forRoot()

    expect(mockInit).toHaveBeenCalledWith({
      dsn: 'https://fake@sentry.io/0',
      release: 'test-release-sha',
    })
  })

  it('does not initialize Sentry without a DSN', () => {
    WorkerObservabilityModule.forRoot()

    expect(mockInit).not.toHaveBeenCalled()
  })
})
