import { Certification, UserCertification } from '@readion/db'
import { describe, expect, it } from 'vitest'
import { mapUserCertificationToDto } from './user-certifications.mapper'

function buildCert(id = 'cert-id-1'): Certification {
  const cert = new Certification()
  cert.id = id
  cert.name = 'AWS Cloud Practitioner'
  cert.provider = 'AWS'
  cert.code = 'CLF-C02'
  cert.domains = [{ name: 'Cloud Concepts', weight: 100 }]
  cert.questionCount = 65
  cert.passingScore = 700
  cert.timeLimitMinutes = 90
  cert.state = 'live'
  cert.provenance = 'verified'
  cert.verifiedAt = null
  return cert
}

function buildEnrollment(overrides: Partial<UserCertification> = {}): UserCertification {
  const enrollment = new UserCertification()
  enrollment.certification = buildCert()
  enrollment.status = 'active'
  enrollment.enrolledAt = new Date('2026-06-26T10:00:00.000Z')
  enrollment.sessionOverrideDuration = null
  enrollment.sessionOverrideContentMix = null
  enrollment.sessionOverrideDifficulty = null
  enrollment.sessionOverrideFocusArea = null
  enrollment.sessionOverrideLearningStyle = null
  Object.assign(enrollment, overrides)
  return enrollment
}

describe('mapUserCertificationToDto', () => {
  it('maps all required fields', () => {
    const enrollment = buildEnrollment()
    const dto = mapUserCertificationToDto(enrollment)

    expect(dto.id).toBe(enrollment.id)
    expect(dto.certificationId).toBe('cert-id-1')
    expect(dto.status).toBe('active')
    expect(dto.enrolledAt).toBe('2026-06-26T10:00:00.000Z')
  })

  it('maps session override fields as null when not set', () => {
    const dto = mapUserCertificationToDto(buildEnrollment())

    expect(dto.sessionDefaults.duration).toBeNull()
    expect(dto.sessionDefaults.contentMix).toBeNull()
    expect(dto.sessionDefaults.difficulty).toBeNull()
    expect(dto.sessionDefaults.focusArea).toBeNull()
    expect(dto.sessionDefaults.learningStyle).toBeNull()
  })

  it('maps populated session override fields', () => {
    const enrollment = buildEnrollment({
      sessionOverrideDuration: 60,
      sessionOverrideDifficulty: 'advanced',
    })
    const dto = mapUserCertificationToDto(enrollment)

    expect(dto.sessionDefaults.duration).toBe(60)
    expect(dto.sessionDefaults.difficulty).toBe('advanced')
    expect(dto.sessionDefaults.contentMix).toBeNull()
  })

  it('maps archived status', () => {
    const dto = mapUserCertificationToDto(buildEnrollment({ status: 'archived' }))
    expect(dto.status).toBe('archived')
  })

  it('does not expose user or internal db fields', () => {
    const dto = mapUserCertificationToDto(buildEnrollment())

    expect(dto).not.toHaveProperty('user')
    expect(dto).not.toHaveProperty('passwordHash')
    expect(dto).not.toHaveProperty('createdAt')
    expect(dto).not.toHaveProperty('updatedAt')
    expect(dto).not.toHaveProperty('sessionOverrideDuration')
  })
})
