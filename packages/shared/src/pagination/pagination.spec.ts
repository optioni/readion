import { describe, expect, expectTypeOf, it } from 'vitest'
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from './constants'
import type { PaginationQueryParams } from './types'

describe('pagination constants', () => {
  it('PAGE_SIZE_DEFAULT is 25', () => {
    expect(PAGE_SIZE_DEFAULT).toBe(25)
  })

  it('PAGE_SIZE_MAX is 100', () => {
    expect(PAGE_SIZE_MAX).toBe(100)
  })
})

describe('PaginationQueryParams', () => {
  it('page and limit are optional numbers', () => {
    const params: PaginationQueryParams = {}
    expectTypeOf(params.page).toEqualTypeOf<number | undefined>()
    expectTypeOf(params.limit).toEqualTypeOf<number | undefined>()
  })

  it('accepts page and limit values', () => {
    const params: PaginationQueryParams = { page: 2, limit: 25 }
    expect(params.page).toBe(2)
    expect(params.limit).toBe(25)
  })
})
