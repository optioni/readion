import { describe, expect, it, vi } from 'vitest'
import { chunkReverseIndexKey, evictByChunkId } from './index'

describe('chunk-lifecycle key convention', () => {
  it('chunkReverseIndexKey produces chunk:{id}', () => {
    expect(chunkReverseIndexKey('abc-123')).toBe('chunk:abc-123')
  })

  it('chunkReverseIndexKey is deterministic for the same id', () => {
    const id = '00000000-0000-0000-0000-000000000001'
    expect(chunkReverseIndexKey(id)).toBe(chunkReverseIndexKey(id))
  })

  it('chunkReverseIndexKey produces unique keys for different ids', () => {
    expect(chunkReverseIndexKey('id-a')).not.toBe(chunkReverseIndexKey('id-b'))
  })
})

describe('evictByChunkId', () => {
  it('deletes index key and all cache keys when the reverse index is populated', async () => {
    const del = vi.fn().mockResolvedValue(2)
    const redis = {
      smembers: vi.fn().mockResolvedValue(['llm:key-a', 'llm:key-b']),
      del,
    }
    await evictByChunkId(redis, 'chunk-id-1')
    expect(del).toHaveBeenCalledWith('chunk:chunk-id-1', 'llm:key-a', 'llm:key-b')
  })

  it('deletes only the index key when no cache keys are registered', async () => {
    const del = vi.fn().mockResolvedValue(1)
    const redis = {
      smembers: vi.fn().mockResolvedValue([]),
      del,
    }
    await evictByChunkId(redis, 'chunk-id-2')
    expect(del).toHaveBeenCalledWith('chunk:chunk-id-2')
  })
})
