import { defineEntity, p } from '@mikro-orm/core'
import { v4 } from 'uuid'

export const BaseSchema = defineEntity({
  name: 'BaseEntity',
  abstract: true,
  properties: {
    id: p.uuid().primary(),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
})

export abstract class BaseEntity extends BaseSchema.class {
  id: string = v4()
}
