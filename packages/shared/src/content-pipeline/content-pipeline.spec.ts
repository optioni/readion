import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type ContentSourceResponse,
  type ContentSourceType,
  contentSourceTypes,
  type EnqueuedJobResponse,
  type IngestionJobStatus,
  ingestionQueueName,
  registerSourceRequestSchema,
} from './index'

describe('contentSourceTypes', () => {
  it('does not offer quizlet as a source type', () => {
    expect(contentSourceTypes).not.toContain('quizlet')
  })
})

describe('ingestionQueueName', () => {
  it('prefixes the source type with ingestion-', () => {
    expect(ingestionQueueName('web')).toBe('ingestion-web')
  })

  it('handles other source types', () => {
    expect(ingestionQueueName('youtube')).toBe('ingestion-youtube')
    expect(ingestionQueueName('github')).toBe('ingestion-github')
  })
})

describe('registerSourceRequestSchema', () => {
  const validRequest = {
    certificationId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'web' as const,
    url: 'https://example.com/feed',
  }

  it('accepts a valid request without recheckIntervalMinutes', () => {
    const result = registerSourceRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
  })

  it('accepts a valid request with a positive recheckIntervalMinutes', () => {
    const result = registerSourceRequestSchema.safeParse({
      ...validRequest,
      recheckIntervalMinutes: 1440,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown source type', () => {
    const result = registerSourceRequestSchema.safeParse({
      ...validRequest,
      type: 'rss',
    })
    expect(result.success).toBe(false)
  })

  it('rejects quizlet as a source type', () => {
    const result = registerSourceRequestSchema.safeParse({
      ...validRequest,
      type: 'quizlet',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-UUID certificationId', () => {
    const result = registerSourceRequestSchema.safeParse({
      ...validRequest,
      certificationId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid url', () => {
    const result = registerSourceRequestSchema.safeParse({
      ...validRequest,
      url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive recheckIntervalMinutes', () => {
    const result = registerSourceRequestSchema.safeParse({
      ...validRequest,
      recheckIntervalMinutes: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-integer recheckIntervalMinutes', () => {
    const result = registerSourceRequestSchema.safeParse({
      ...validRequest,
      recheckIntervalMinutes: 12.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('ContentSourceResponse', () => {
  it('has the documented field shape', () => {
    expectTypeOf<ContentSourceResponse>().toEqualTypeOf<{
      id: string
      certificationId: string
      type: ContentSourceType
      url: string
      enabled: boolean
      lastFetchedAt: string | null
      recheckIntervalMinutes: number
      createdAt: string
      chunkCount: number
    }>()
  })
})

describe('EnqueuedJobResponse', () => {
  it('has the documented field shape', () => {
    expectTypeOf<EnqueuedJobResponse>().toEqualTypeOf<{
      jobId: string
      contentSourceId: string
      state: string
    }>()
  })
})

describe('IngestionJobStatus', () => {
  it('has the documented field shape', () => {
    expectTypeOf<IngestionJobStatus>().toEqualTypeOf<{
      jobId: string
      state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' | 'unknown'
      progress: number
      attemptsMade: number
      failedReason: string | null
      timestamp: number | null
      processedOn: number | null
      finishedOn: number | null
    }>()
  })
})
