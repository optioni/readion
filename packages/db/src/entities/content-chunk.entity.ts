import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { ChunkMetadata, ChunkState, DomainTag } from '@readion/shared'
import { EMBEDDING_DIMENSION } from '@readion/shared'
import { v4 } from 'uuid'
import { VectorType } from '../types/vector.type'
import { BaseSchema } from './base.entity'

export const ContentChunkSchema = defineEntity({
  name: 'ContentChunk',
  tableName: 'content_chunks',
  extends: BaseSchema,
  properties: {
    contentSourceId: p.uuid(),
    certificationId: p.uuid(),
    text: p.text(),
    contentHash: p.string().length(64),
    embedding: p.type(new VectorType(EMBEDDING_DIMENSION)).nullable(),
    domainTags: p.json<DomainTag[]>(),
    primaryDomain: p.string(),
    metadata: p.json<ChunkMetadata>(),
    state: p.string().default('active'),
    supersededById: p.uuid().nullable(),
    supersededAt: p.datetime().nullable(),
  },
})

export class ContentChunk extends ContentChunkSchema.class {
  [OptionalProps]?: 'embedding' | 'metadata' | 'state' | 'supersededById' | 'supersededAt'

  override id: string = v4()
  override contentSourceId!: string
  override certificationId!: string
  override text!: string
  override contentHash!: string
  override embedding: number[] | null = null
  override domainTags!: DomainTag[]
  override primaryDomain!: string
  override metadata: ChunkMetadata = {}
  override state: ChunkState = 'active'
  override supersededById: string | null = null
  override supersededAt: Date | null = null
}

ContentChunkSchema.setClass(ContentChunk)
