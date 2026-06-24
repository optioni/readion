import { Certification } from '@readion/db'
import { describe, expect, it } from 'vitest'
import { mapCertificationToDto } from './certifications.mapper'

function buildCert(overrides: Partial<Certification> = {}): Certification {
  const cert = new Certification()
  cert.name = 'AWS Cloud Practitioner'
  cert.provider = 'AWS'
  cert.code = 'CLF-C02'
  cert.domains = [
    { name: 'Cloud Concepts', weight: 24 },
    { name: 'Security and Compliance', weight: 30 },
    { name: 'Cloud Technology and Services', weight: 34 },
    { name: 'Billing, Pricing, and Support', weight: 12 },
  ]
  cert.questionCount = 65
  cert.passingScore = 700
  cert.timeLimitMinutes = 90
  cert.state = 'draft'
  cert.provenance = 'verified'
  cert.verifiedAt = new Date('2026-06-24')
  Object.assign(cert, overrides)
  return cert
}

describe('mapCertificationToDto', () => {
  it('maps all required fields', () => {
    const cert = buildCert()
    const dto = mapCertificationToDto(cert)

    expect(dto.id).toBe(cert.id)
    expect(dto.name).toBe('AWS Cloud Practitioner')
    expect(dto.provider).toBe('AWS')
    expect(dto.code).toBe('CLF-C02')
    expect(dto.questionCount).toBe(65)
    expect(dto.passingScore).toBe(700)
    expect(dto.timeLimitMinutes).toBe(90)
    expect(dto.state).toBe('draft')
  })

  it('maps weighted domains list', () => {
    const cert = buildCert()
    const dto = mapCertificationToDto(cert)

    expect(dto.domains).toHaveLength(4)
    expect(dto.domains[0]).toEqual({ name: 'Cloud Concepts', weight: 24 })
    expect(dto.domains.reduce((sum, d) => sum + d.weight, 0)).toBe(100)
  })

  it('does not expose internal or user-specific fields', () => {
    const cert = buildCert()
    const dto = mapCertificationToDto(cert)

    expect(dto).not.toHaveProperty('provenance')
    expect(dto).not.toHaveProperty('verifiedAt')
    expect(dto).not.toHaveProperty('createdAt')
    expect(dto).not.toHaveProperty('updatedAt')
    expect(dto).not.toHaveProperty('readinessScore')
    expect(dto).not.toHaveProperty('passwordHash')
  })

  it('preserves domain weights from live cert', () => {
    const cert = buildCert({ state: 'live' })
    const dto = mapCertificationToDto(cert)
    expect(dto.state).toBe('live')
  })
})
