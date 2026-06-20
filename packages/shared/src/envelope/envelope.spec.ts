import { describe, expectTypeOf, it } from 'vitest'
import type { CollectionEnvelope, RelationshipRef, SingleResourceEnvelope } from './types'

describe('RelationshipRef', () => {
  it('href is required', () => {
    const ref: RelationshipRef = { href: '/api/v1/items/1' }
    expectTypeOf(ref.href).toEqualTypeOf<string>()
  })

  it('data is optional and can be undefined', () => {
    const ref: RelationshipRef = { href: '/api/v1/items/1' }
    expectTypeOf(ref.data).toEqualTypeOf<unknown | unknown[] | null | undefined>()
  })

  it('data can be a single reference', () => {
    type Item = { id: string }
    const ref: RelationshipRef<Item> = { href: '/api/v1/items/1', data: { id: '1' } }
    expectTypeOf(ref.data).toEqualTypeOf<Item | Item[] | null | undefined>()
  })

  it('data can be an array of references', () => {
    type Item = { id: string; domain: string; score: number }
    const ref: RelationshipRef<Item> = {
      href: '/api/v1/items',
      data: [
        { id: 'a', domain: 'Billing', score: 48 },
        { id: 'b', domain: 'Security', score: 61 },
      ],
    }
    expectTypeOf(ref.data).toEqualTypeOf<Item | Item[] | null | undefined>()
  })

  it('data can be null', () => {
    const ref: RelationshipRef = { href: '/api/v1/items/1', data: null }
    expectTypeOf(ref.data).toEqualTypeOf<unknown | unknown[] | null | undefined>()
  })
})

describe('SingleResourceEnvelope', () => {
  it('wraps a typed resource in data', () => {
    type Cert = { id: string; name: string; readinessScore: number }
    const env: SingleResourceEnvelope<Cert> = {
      data: { id: '1', name: 'AWS', readinessScore: 75 },
    }
    expectTypeOf(env.data.name).toEqualTypeOf<string>()
    expectTypeOf(env.data.readinessScore).toEqualTypeOf<number>()
  })

  it('relationships is optional', () => {
    type Cert = { id: string }
    const env: SingleResourceEnvelope<Cert> = { data: { id: '1' } }
    expectTypeOf(env.relationships).toEqualTypeOf<
      Record<string, RelationshipRef<unknown>> | undefined
    >()
  })
})

describe('CollectionEnvelope', () => {
  it('wraps an array of typed resources', () => {
    type Item = { id: string }
    const env: CollectionEnvelope<Item> = {
      data: [{ id: '1' }],
      meta: { total: 100, page: 1, limit: 25 },
    }
    expectTypeOf(env.data).toEqualTypeOf<Item[]>()
  })

  it('meta has numeric total, page, limit', () => {
    type Item = { id: string }
    const env: CollectionEnvelope<Item> = {
      data: [],
      meta: { total: 0, page: 1, limit: 25 },
    }
    expectTypeOf(env.meta.total).toEqualTypeOf<number>()
    expectTypeOf(env.meta.page).toEqualTypeOf<number>()
    expectTypeOf(env.meta.limit).toEqualTypeOf<number>()
  })
})
