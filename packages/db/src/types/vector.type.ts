import { Type } from '@mikro-orm/core'

export class VectorType extends Type<number[] | null, string | null> {
  constructor(private readonly dimension: number) {
    super()
  }

  override convertToDatabaseValue(value: number[] | null): string | null {
    if (value == null) return null
    return `[${value.join(',')}]`
  }

  override convertToJSValue(value: string | null): number[] | null {
    if (value == null) return null
    return JSON.parse(value) as number[]
  }

  override getColumnType(): string {
    return `vector(${this.dimension})`
  }
}

export function buildHnswIndexDdl(table: string, column: string, indexName?: string): string {
  const name = indexName ?? `${table}_${column}_hnsw_idx`
  return `CREATE INDEX ${name} ON ${table} USING hnsw (${column} vector_cosine_ops)`
}
