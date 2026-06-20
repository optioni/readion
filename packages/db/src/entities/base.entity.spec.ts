import { defineEntity } from '@mikro-orm/core'
import { validate as uuidValidate, version as uuidVersion } from 'uuid'
import { describe, expect, it } from 'vitest'
import { BaseEntity, BaseSchema } from './base.entity'

const SpecItemSchema = defineEntity({
  name: 'SpecItem',
  tableName: 'spec_items',
  extends: BaseSchema,
  properties: {},
})
class SpecItem extends BaseEntity {}
SpecItemSchema.setClass(SpecItem)

describe('BaseEntity', () => {
  it('assigns a UUID v4 id on instantiation', () => {
    const item = new SpecItem()
    expect(uuidValidate(item.id)).toBe(true)
    expect(uuidVersion(item.id)).toBe(4)
  })

  it('each instance gets a unique id', () => {
    const a = new SpecItem()
    const b = new SpecItem()
    expect(a.id).not.toBe(b.id)
  })

  it('id is an own property set before any ORM interaction', () => {
    const item = new SpecItem()
    expect(Object.hasOwn(item, 'id')).toBe(true)
  })
})
