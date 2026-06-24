import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type EnrollmentResponse,
  type EnrollmentStatus,
  enrollCertificationRequestSchema,
  enrollmentStatuses,
  updateEnrollmentRequestSchema,
} from './index'

describe('user-certifications shared contracts', () => {
  it('exports enrollment status constants', () => {
    expect(enrollmentStatuses).toEqual(['active', 'archived'])
    expectTypeOf<EnrollmentStatus>().toEqualTypeOf<'active' | 'archived'>()
  })

  describe('enrollCertificationRequestSchema', () => {
    it('accepts certificationId only', () => {
      const result = enrollCertificationRequestSchema.safeParse({
        certificationId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })

    it('accepts certificationId with partial session defaults', () => {
      const result = enrollCertificationRequestSchema.safeParse({
        certificationId: '550e8400-e29b-41d4-a716-446655440000',
        sessionDefaults: { duration: 60, difficulty: 'advanced' },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sessionDefaults?.duration).toBe(60)
        expect(result.data.sessionDefaults?.difficulty).toBe('advanced')
        expect(result.data.sessionDefaults?.contentMix).toBeUndefined()
      }
    })

    it('rejects missing certificationId', () => {
      expect(
        enrollCertificationRequestSchema.safeParse({ sessionDefaults: { duration: 30 } }).success,
      ).toBe(false)
    })

    it('rejects non-UUID certificationId', () => {
      expect(
        enrollCertificationRequestSchema.safeParse({ certificationId: 'not-a-uuid' }).success,
      ).toBe(false)
    })

    it('rejects invalid session default values', () => {
      expect(
        enrollCertificationRequestSchema.safeParse({
          certificationId: '550e8400-e29b-41d4-a716-446655440000',
          sessionDefaults: { duration: 45 },
        }).success,
      ).toBe(false)

      expect(
        enrollCertificationRequestSchema.safeParse({
          certificationId: '550e8400-e29b-41d4-a716-446655440000',
          sessionDefaults: { difficulty: 'impossible' },
        }).success,
      ).toBe(false)
    })
  })

  describe('updateEnrollmentRequestSchema', () => {
    it('accepts partial session defaults', () => {
      const result = updateEnrollmentRequestSchema.safeParse({
        sessionDefaults: { learningStyle: 'spaced-repetition' },
      })
      expect(result.success).toBe(true)
    })

    it('accepts null to clear an override', () => {
      const result = updateEnrollmentRequestSchema.safeParse({
        sessionDefaults: { duration: null },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sessionDefaults?.duration).toBeNull()
      }
    })

    it('rejects invalid override values', () => {
      expect(
        updateEnrollmentRequestSchema.safeParse({
          sessionDefaults: { difficulty: 'impossible' },
        }).success,
      ).toBe(false)
    })

    it('accepts empty body', () => {
      expect(updateEnrollmentRequestSchema.safeParse({}).success).toBe(true)
      expect(updateEnrollmentRequestSchema.safeParse({ sessionDefaults: {} }).success).toBe(true)
    })
  })

  it('EnrollmentResponse type has correct shape', () => {
    expectTypeOf<EnrollmentResponse>().toHaveProperty('id')
    expectTypeOf<EnrollmentResponse>().toHaveProperty('certificationId')
    expectTypeOf<EnrollmentResponse>().toHaveProperty('status')
    expectTypeOf<EnrollmentResponse>().toHaveProperty('enrolledAt')
    expectTypeOf<EnrollmentResponse>().toHaveProperty('sessionDefaults')
    expectTypeOf<EnrollmentResponse['status']>().toEqualTypeOf<EnrollmentStatus>()
    expectTypeOf<EnrollmentResponse['sessionDefaults']['duration']>().toEqualTypeOf<number | null>()
  })
})
