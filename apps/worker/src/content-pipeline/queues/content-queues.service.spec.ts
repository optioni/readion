import { describe, expect, it, vi } from 'vitest'
import { ContentQueuesService } from './content-queues.service'

function makeQueue() {
  return { add: vi.fn().mockResolvedValue({ id: 'job-1' }), name: 'mock-queue' }
}

describe('ContentQueuesService', () => {
  it('enqueue adds a job to the correct source-type queue', async () => {
    const webQueue = makeQueue()
    const pdfQueue = makeQueue()
    const service = new ContentQueuesService(
      webQueue as any, pdfQueue as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
    )

    await service.enqueue('source-id', 'web', ['Security'])
    expect(webQueue.add).toHaveBeenCalledWith(
      'ingest',
      { contentSourceId: 'source-id', domains: ['Security'] },
      { priority: undefined },
    )
    expect(pdfQueue.add).not.toHaveBeenCalled()
  })

  it('enqueue with priority passes it to the queue', async () => {
    const webQueue = makeQueue()
    const service = new ContentQueuesService(
      webQueue as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
    )

    await service.enqueue('source-id', 'web', [], 1)
    expect(webQueue.add).toHaveBeenCalledWith(
      'ingest',
      expect.any(Object),
      { priority: 1 },
    )
  })

  it('getQueue returns the queue for a given source type', () => {
    const webQueue = makeQueue()
    const service = new ContentQueuesService(
      webQueue as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
    )

    expect(service.getQueue('web')).toBe(webQueue)
    expect(service.getQueue('pdf')).not.toBe(webQueue)
  })

  it('throws when enqueueing to an unknown source type', async () => {
    const service = new ContentQueuesService(
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
      makeQueue() as any, makeQueue() as any,
    )

    await expect(service.enqueue('id', 'invalid' as any, [])).rejects.toThrow(
      'No queue registered',
    )
  })
})
