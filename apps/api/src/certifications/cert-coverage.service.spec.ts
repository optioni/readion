import type { EntityManager } from '@mikro-orm/core'
import { NotFoundException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { CertificationCoverageService } from './cert-coverage.service'

function makeCert(overrides: { state?: 'draft' | 'live'; domains?: string[] } = {}) {
  return {
    id: 'cert-1',
    state: overrides.state ?? 'draft',
    domains: (overrides.domains ?? ['Security', 'IAM']).map((name) => ({ name, weight: 50 })),
    questionCount: 50,
  }
}

function makeEm(cert: ReturnType<typeof makeCert> | null) {
  const forkedEm = { findOne: vi.fn().mockResolvedValue(cert) }
  const em = { fork: vi.fn().mockReturnValue(forkedEm) }
  return em as unknown as EntityManager
}

function makeConfig(minChunks = 20, totalMultiple = 3): ConfigService<EnvConfig> {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN') return minChunks
      if (key === 'CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE') return totalMultiple
      return undefined
    }),
  } as unknown as ConfigService<EnvConfig>
}

function makeQueryStats(chunkCount: number, enabledSourceCount: number) {
  return vi.fn().mockResolvedValue({
    domains: [
      { name: 'Security', chunkCount, enabledSourceCount },
      { name: 'IAM', chunkCount, enabledSourceCount },
    ],
    totalChunks: chunkCount * 2,
  })
}

describe('CertificationCoverageService', () => {
  it('assembles the CoverageReport with state and domain details', async () => {
    const cert = makeCert({ state: 'draft', domains: ['Security', 'IAM'] })
    const service = new CertificationCoverageService(
      makeEm(cert),
      makeQueryStats(12, 1),
      makeConfig(),
    )

    const report = await service.getCoverageReport('cert-1')

    expect(report.state).toBe('draft')
    expect(report.met).toBe(false)
    expect(report.totalChunks).toBe(24)
    expect(report.totalThreshold).toBe(150) // 3 × 50

    const security = report.domains.find((d) => d.name === 'Security')
    expect(security?.chunkCount).toBe(12)
    expect(security?.chunkThreshold).toBe(20)
    expect(security?.met).toBe(false)
  })

  it('throws NotFoundException when cert does not exist', async () => {
    const service = new CertificationCoverageService(
      makeEm(null),
      makeQueryStats(0, 0),
      makeConfig(),
    )

    await expect(service.getCoverageReport('missing-id')).rejects.toThrow(NotFoundException)
  })

  it('includes live state when cert is live', async () => {
    const cert = makeCert({ state: 'live', domains: ['Security'] })
    const service = new CertificationCoverageService(
      makeEm(cert),
      makeQueryStats(25, 1),
      makeConfig(),
    )

    const report = await service.getCoverageReport('cert-1')
    expect(report.state).toBe('live')
  })
})
