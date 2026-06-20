import { describe, expect, it } from 'vitest'
import { buildHnswIndexDdl, VectorType } from './vector.type'

describe('VectorType', () => {
  const type = new VectorType(1536)

  it('declares column type with fixed dimension', () => {
    expect(type.getColumnType()).toBe('vector(1536)')
  })

  it('serializes JS array to pgvector literal', () => {
    expect(type.convertToDatabaseValue([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]')
  })

  it('hydrates pgvector literal to JS numeric array', () => {
    expect(type.convertToJSValue('[0.1,0.2,0.3]')).toEqual([0.1, 0.2, 0.3])
  })

  it('returns null unchanged for null values', () => {
    expect(type.convertToDatabaseValue(null as unknown as number[])).toBeNull()
    expect(type.convertToJSValue(null as unknown as string)).toBeNull()
  })
})

describe('buildHnswIndexDdl', () => {
  it('emits HNSW index using cosine operator class', () => {
    const ddl = buildHnswIndexDdl('content_chunks', 'embedding')
    expect(ddl).toContain('USING hnsw (embedding vector_cosine_ops)')
  })

  it('includes table name in the CREATE INDEX statement', () => {
    const ddl = buildHnswIndexDdl('content_chunks', 'embedding')
    expect(ddl).toContain('content_chunks')
  })

  it('accepts a custom index name', () => {
    const ddl = buildHnswIndexDdl('content_chunks', 'embedding', 'my_idx')
    expect(ddl).toContain('my_idx')
  })
})
