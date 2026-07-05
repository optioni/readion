import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import type {
  CollectionEnvelope,
  ProblemDetails,
  SingleResourceEnvelope,
  ValidationErrorItem,
} from './index'
import {
  dbConnectionEnvFragment,
  ERROR_TYPES,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  redisUrlFragment,
  zodCoerceBoolean,
  zodCoerceNumber,
  zodRequiredUrl,
} from './index'

describe('shared-contracts acceptance', () => {
  describe('response envelope', () => {
    it('wraps a single resource', () => {
      type Cert = { id: string; name: string; readinessScore: number }
      const envelope: SingleResourceEnvelope<Cert> = {
        data: { id: '1', name: 'AWS Cloud Practitioner', readinessScore: 75 },
      }
      expectTypeOf(envelope.data.name).toEqualTypeOf<string>()
      expectTypeOf(envelope.data.readinessScore).toEqualTypeOf<number>()
    })

    it('relationships block is optional on single resource', () => {
      type Cert = { id: string; name: string }
      const envelope: SingleResourceEnvelope<Cert> = {
        data: { id: '1', name: 'AWS' },
      }
      expect(envelope.data.id).toBe('1')
    })

    it('wraps a collection with meta', () => {
      type Item = { id: string }
      const envelope: CollectionEnvelope<Item> = {
        data: [{ id: '1' }],
        meta: { total: 100, page: 1, limit: 25 },
      }
      expectTypeOf(envelope.data).toEqualTypeOf<Item[]>()
      expectTypeOf(envelope.meta.total).toEqualTypeOf<number>()
      expectTypeOf(envelope.meta.page).toEqualTypeOf<number>()
      expectTypeOf(envelope.meta.limit).toEqualTypeOf<number>()
    })

    it('relationships support reference-only (no data)', () => {
      type Cert = { id: string }
      const envelope: SingleResourceEnvelope<Cert> = {
        data: { id: '1' },
        relationships: {
          weakAreas: { href: '/api/v1/user-certifications/1/weak-areas' },
        },
      }
      expect(envelope.relationships?.weakAreas.href).toBe(
        '/api/v1/user-certifications/1/weak-areas',
      )
      expect(envelope.relationships?.weakAreas.data).toBeUndefined()
    })

    it('relationships support expanded array via include', () => {
      type Cert = { id: string }
      const envelope: SingleResourceEnvelope<Cert> = {
        data: { id: '1' },
        relationships: {
          weakAreas: {
            href: '/api/v1/user-certifications/1/weak-areas',
            data: [
              { id: 'a', domain: 'Billing', score: 48 },
              { id: 'b', domain: 'Security', score: 61 },
            ],
          },
        },
      }
      expect(Array.isArray(envelope.relationships?.weakAreas.data)).toBe(true)
    })
  })

  describe('pagination', () => {
    it('PAGE_SIZE_DEFAULT is 25', () => {
      expect(PAGE_SIZE_DEFAULT).toBe(25)
    })

    it('PAGE_SIZE_MAX is 100', () => {
      expect(PAGE_SIZE_MAX).toBe(100)
    })
  })

  describe('problem details', () => {
    it('accepts minimal problem details', () => {
      const pd: ProblemDetails = {
        type: '/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Certification abc does not exist',
      }
      expectTypeOf(pd.status).toEqualTypeOf<number>()
    })

    it('accepts problem details with field errors', () => {
      const pd: ProblemDetails = {
        type: '/errors/validation-error',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Validation failed',
        errors: [{ field: 'email', message: 'Email is already taken' }],
      }
      expectTypeOf(pd.errors?.[0]?.field).toEqualTypeOf<string>()
      expectTypeOf(pd.errors?.[0]?.message).toEqualTypeOf<string>()
    })

    it('field error item shape type-checks', () => {
      const item: ValidationErrorItem = {
        field: 'password',
        message: 'Must be at least 12 characters',
      }
      expectTypeOf(item.field).toEqualTypeOf<string>()
    })

    it('ERROR_TYPES.VALIDATION is /errors/validation-error', () => {
      expect(ERROR_TYPES.VALIDATION).toBe('/errors/validation-error')
    })

    it('ERROR_TYPES values are literal types', () => {
      expectTypeOf(ERROR_TYPES.VALIDATION).toEqualTypeOf<'/errors/validation-error'>()
    })
  })

  describe('env-schema helpers', () => {
    it('required URL accepts valid postgres URL', () => {
      const result = zodRequiredUrl().safeParse('postgres://localhost:5432/readion')
      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toBe('postgres://localhost:5432/readion')
    })

    it('required URL rejects malformed value', () => {
      const result = zodRequiredUrl().safeParse('not-a-url')
      expect(result.success).toBe(false)
    })

    it('coerced number parses string "9090" to 9090', () => {
      const result = zodCoerceNumber().safeParse('9090')
      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toBe(9090)
    })

    it('coerced boolean parses', () => {
      const result = zodCoerceBoolean().safeParse('true')
      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toBe(true)
    })

    it('composed DB+Redis fragments parse valid object', () => {
      const schema = z.object({ ...dbConnectionEnvFragment, ...redisUrlFragment })
      const result = schema.safeParse({
        DB_HOST: 'localhost',
        REDIS_URL: 'redis://localhost:6379',
      })
      expect(result.success).toBe(true)
    })

    it('missing REDIS_URL is reported', () => {
      const schema = z.object({ ...redisUrlFragment })
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        const fields = result.error.issues.map((i) => i.path[0])
        expect(fields).toContain('REDIS_URL')
      }
    })
  })
})
