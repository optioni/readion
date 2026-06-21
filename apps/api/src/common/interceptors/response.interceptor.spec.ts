import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { of } from 'rxjs'
import { describe, expect, it } from 'vitest'
import { isCollectionResult, isEnveloped, ResponseInterceptor } from './response.interceptor'

function makeContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext
}

function callInterceptor(value: unknown) {
  const reflector = new Reflector()
  const interceptor = new ResponseInterceptor(reflector)
  const next = { handle: () => of(value) }
  return new Promise((resolve, reject) => {
    interceptor.intercept(makeContext(), next).subscribe({ next: resolve, error: reject })
  })
}

describe('ResponseInterceptor', () => {
  it('wraps a plain object in { data }', async () => {
    const result = await callInterceptor({ id: '1', name: 'AWS Cloud Practitioner' })
    expect(result).toEqual({ data: { id: '1', name: 'AWS Cloud Practitioner' } })
  })

  it('passes through an already-enveloped value unchanged', async () => {
    const enveloped = { data: { id: '1' }, meta: { total: 1 } }
    const result = await callInterceptor(enveloped)
    expect(result).toEqual(enveloped)
  })

  it('converts a CollectionResult into { data, meta }', async () => {
    const collection = {
      items: [{ id: 'a' }, { id: 'b' }],
      meta: { total: 100, page: 1, limit: 25 },
    }
    const result = await callInterceptor(collection)
    expect(result).toEqual({
      data: [{ id: 'a' }, { id: 'b' }],
      meta: { total: 100, page: 1, limit: 25 },
    })
  })

  it('does not double-wrap a value that already has a data key', async () => {
    const alreadyWrapped = { data: { nested: true } }
    const result = await callInterceptor(alreadyWrapped)
    expect((result as { data: { data?: unknown } }).data.data).not.toBeDefined()
    expect(result).toEqual({ data: { nested: true } })
  })
})

describe('isEnveloped', () => {
  it('returns true for objects with a data key', () => {
    expect(isEnveloped({ data: {} })).toBe(true)
  })

  it('returns false for objects without data key', () => {
    expect(isEnveloped({ id: '1' })).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isEnveloped(null)).toBe(false)
    expect(isEnveloped('string')).toBe(false)
    expect(isEnveloped(42)).toBe(false)
  })
})

describe('isCollectionResult', () => {
  it('returns true when value has items array and meta with pagination', () => {
    expect(isCollectionResult({ items: [], meta: { total: 0, page: 1, limit: 25 } })).toBe(true)
  })

  it('returns false for plain objects', () => {
    expect(isCollectionResult({ id: '1' })).toBe(false)
  })

  it('returns false for already-enveloped values', () => {
    expect(isCollectionResult({ data: [], meta: {} })).toBe(false)
  })
})
