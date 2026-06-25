import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import { type ContentSourceType, contentSourceTypes } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const ContentSourceSchema = defineEntity({
  name: 'ContentSource',
  tableName: 'content_sources',
  extends: BaseSchema,
  properties: {
    certificationId: p.uuid(),
    type: p.enum([...contentSourceTypes]),
    url: p.string(),
    enabled: p.boolean().default(true),
    lastFetchedAt: p.datetime().nullable(),
    recheckIntervalMinutes: p.integer(),
  },
})

export class ContentSource extends ContentSourceSchema.class {
  [OptionalProps]?: 'enabled' | 'lastFetchedAt'

  override id: string = v4()
  override certificationId!: string
  override type!: ContentSourceType
  override url!: string
  override enabled: boolean = true
  override lastFetchedAt: Date | null = null
  override recheckIntervalMinutes!: number
}

ContentSourceSchema.setClass(ContentSource)
