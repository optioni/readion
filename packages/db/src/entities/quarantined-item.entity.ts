import { defineEntity, OptionalProps, p } from '@mikro-orm/core'
import type { Provenance } from '@readion/shared'
import { v4 } from 'uuid'
import { BaseSchema } from './base.entity'

export const quarantinedItemStatuses = ['pending', 'approved', 'rejected'] as const

export type QuarantinedItemStatus = (typeof quarantinedItemStatuses)[number]

export const QuarantinedItemSchema = defineEntity({
  name: 'QuarantinedItem',
  tableName: 'quarantined_items',
  extends: BaseSchema,
  properties: {
    certificationId: p.uuid(),
    domain: p.string(),
    verdict: p.string(),
    reason: p.string(),
    status: p.enum([...quarantinedItemStatuses]).default('pending'),
    cacheKey: p.string(),
    provenance: p.json<Provenance>(),
    generatedContent: p.json<Record<string, unknown>>().nullable(),
  },
})

export class QuarantinedItem extends QuarantinedItemSchema.class {
  [OptionalProps]?: 'status' | 'generatedContent'

  override id: string = v4()
  override certificationId!: string
  override domain!: string
  override verdict!: string
  override reason!: string
  override status: QuarantinedItemStatus = 'pending'
  override cacheKey!: string
  override provenance!: Provenance
  override generatedContent: Record<string, unknown> | null = null
}

QuarantinedItemSchema.setClass(QuarantinedItem)
