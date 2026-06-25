import { describe, expect, it } from 'vitest'
import { buildCacheKey } from './cache-key.builder'

describe('buildCacheKey', () => {
  it('returns a non-empty string key', () => {
    const key = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c1'],
      difficulty: 'medium',
      format: 'mcq',
    })
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('produces the same key for identical inputs', () => {
    const input = {
      certificationId: 'aws-saa',
      chunkIds: ['c1', 'c2'],
      difficulty: 'medium',
      format: 'mcq',
    }
    expect(buildCacheKey(input)).toBe(buildCacheKey(input))
  })

  it('chunk-id order does not change the key', () => {
    const key1 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['a', 'b', 'c'],
      difficulty: 'medium',
      format: 'mcq',
    })
    const key2 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c', 'a', 'b'],
      difficulty: 'medium',
      format: 'mcq',
    })
    expect(key1).toBe(key2)
  })

  it('produces a different key when certificationId differs', () => {
    const key1 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c1'],
      difficulty: 'medium',
      format: 'mcq',
    })
    const key2 = buildCacheKey({
      certificationId: 'aws-dva',
      chunkIds: ['c1'],
      difficulty: 'medium',
      format: 'mcq',
    })
    expect(key1).not.toBe(key2)
  })

  it('produces a different key when difficulty differs', () => {
    const key1 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c1'],
      difficulty: 'medium',
      format: 'mcq',
    })
    const key2 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c1'],
      difficulty: 'hard',
      format: 'mcq',
    })
    expect(key1).not.toBe(key2)
  })

  it('produces a different key when format differs', () => {
    const key1 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c1'],
      difficulty: 'medium',
      format: 'mcq',
    })
    const key2 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c1'],
      difficulty: 'medium',
      format: 'free-response',
    })
    expect(key1).not.toBe(key2)
  })

  it('produces a different key when chunk ids differ', () => {
    const key1 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c1'],
      difficulty: 'medium',
      format: 'mcq',
    })
    const key2 = buildCacheKey({
      certificationId: 'aws-saa',
      chunkIds: ['c2'],
      difficulty: 'medium',
      format: 'mcq',
    })
    expect(key1).not.toBe(key2)
  })
})
