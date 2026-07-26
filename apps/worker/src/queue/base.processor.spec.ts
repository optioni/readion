import { Processor } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import { BaseProcessor } from './base.processor'

@Processor('unit-test-queue')
class ConcreteTestProcessor extends BaseProcessor {
  readonly logger = new Logger(ConcreteTestProcessor.name)
  readonly handleFn: (job: Job) => Promise<unknown>

  constructor(handleFn: (job: Job) => Promise<unknown>) {
    super()
    this.handleFn = handleFn
  }

  async handle(job: Job): Promise<unknown> {
    return this.handleFn(job)
  }
}

function makeMockJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'test-job-id',
    queueName: 'unit-test-queue',
    data: {},
    ...overrides,
  } as Job
}

describe('BaseProcessor', () => {
  describe('Base logs the job lifecycle', () => {
    it('logs started and completed on success', async () => {
      const processor = new ConcreteTestProcessor(async () => 'ok')
      const logSpy = vi.spyOn(processor.logger, 'log')

      await processor.process(makeMockJob())

      const calls = logSpy.mock.calls.map((c) => c[0] as string)
      expect(calls.some((m) => m.includes('started'))).toBe(true)
      expect(calls.some((m) => m.includes('completed'))).toBe(true)
    })

    it('includes queue name and job id in log messages', async () => {
      const processor = new ConcreteTestProcessor(async () => 'ok')
      const logSpy = vi.spyOn(processor.logger, 'log')

      await processor.process(makeMockJob({ id: 'job-123', queueName: 'my-queue' }))

      const calls = logSpy.mock.calls.map((c) => c[0] as string)
      expect(calls.some((m) => m.includes('job-123'))).toBe(true)
      expect(calls.some((m) => m.includes('my-queue'))).toBe(true)
    })
  })

  describe('Handler errors propagate to BullMQ', () => {
    it('logs a failed entry with job id and error message', async () => {
      const processor = new ConcreteTestProcessor(async () => {
        throw new Error('something went wrong')
      })
      const errorSpy = vi.spyOn(processor.logger, 'error')

      await expect(processor.process(makeMockJob({ id: 'fail-job' }))).rejects.toThrow(
        'something went wrong',
      )

      const calls = errorSpy.mock.calls.map((c) => c[0] as string)
      expect(calls.some((m) => m.includes('failed'))).toBe(true)
      expect(calls.some((m) => m.includes('fail-job'))).toBe(true)
      expect(calls.some((m) => m.includes('something went wrong'))).toBe(true)
    })

    it('re-throws the error so BullMQ can retry', async () => {
      const error = new Error('retry me')
      const processor = new ConcreteTestProcessor(async () => {
        throw error
      })

      await expect(processor.process(makeMockJob())).rejects.toBe(error)
    })

    it('logs and re-throws non-Error failures', async () => {
      const processor = new ConcreteTestProcessor(async () => {
        throw 'plain failure'
      })
      const errorSpy = vi.spyOn(processor.logger, 'error')

      await expect(processor.process(makeMockJob())).rejects.toBe('plain failure')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('plain failure'))
    })
  })
})
