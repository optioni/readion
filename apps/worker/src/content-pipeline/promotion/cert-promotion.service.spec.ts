import type { EntityManager } from '@mikro-orm/core'
import type { ConfigService } from '@nestjs/config'
import type { CoverageStats } from '@readion/db'
import { describe, expect, it, vi } from 'vitest'
import type { WorkerEnvConfig } from '../../config/env.schema'
import { CertPromotionService } from './cert-promotion.service'

function makeEm(certState: 'draft' | 'live' | null) {
  const cert =
    certState !== null
      ? {
          id: 'cert-1',
          state: certState as string,
          domains: [{ name: 'Security', weight: 100 }],
          questionCount: 10,
        }
      : null

  const forkedEm = {
    findOne: vi.fn().mockResolvedValue(cert),
    flush: vi.fn().mockResolvedValue(undefined),
  }

  const em = {
    fork: vi.fn().mockReturnValue(forkedEm),
  }

  return { em: em as unknown as EntityManager, forkedEm, cert }
}

function makeConfig(minChunks = 20, totalMultiple = 3): ConfigService<WorkerEnvConfig> {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'CERT_COVERAGE_MIN_CHUNKS_PER_DOMAIN') return minChunks
      if (key === 'CERT_COVERAGE_TOTAL_CHUNK_MULTIPLE') return totalMultiple
      return undefined
    }),
  } as unknown as ConfigService<WorkerEnvConfig>
}

function makeMetStats(met: boolean): CoverageStats {
  // questionCount=10, minChunks=20, totalMultiple=3 → totalThreshold=30
  if (met) {
    return {
      domains: [{ name: 'Security', chunkCount: 25, enabledSourceCount: 1 }],
      totalChunks: 50,
    }
  }
  return {
    domains: [{ name: 'Security', chunkCount: 5, enabledSourceCount: 1 }],
    totalChunks: 10,
  }
}

describe('CertPromotionService', () => {
  it('promotes a draft cert to live when bar is met', async () => {
    const { em, forkedEm, cert } = makeEm('draft')
    const queryStats = vi.fn().mockResolvedValue(makeMetStats(true))

    const service = new CertPromotionService(em, queryStats, makeConfig())
    await service.evaluateAndPromote('cert-1')

    expect(cert!.state).toBe('live')
    expect(forkedEm.flush).toHaveBeenCalled()
  })

  it('leaves a draft cert as draft when bar is not met', async () => {
    const { em, forkedEm, cert } = makeEm('draft')
    const queryStats = vi.fn().mockResolvedValue(makeMetStats(false))

    const service = new CertPromotionService(em, queryStats, makeConfig())
    await service.evaluateAndPromote('cert-1')

    expect(cert!.state).toBe('draft')
    expect(forkedEm.flush).not.toHaveBeenCalled()
  })

  it('does not write to a live cert even when bar is met', async () => {
    const { em, forkedEm } = makeEm('live')
    const queryStats = vi.fn().mockResolvedValue(makeMetStats(true))

    const service = new CertPromotionService(em, queryStats, makeConfig())
    await service.evaluateAndPromote('cert-1')

    expect(forkedEm.flush).not.toHaveBeenCalled()
  })

  it('re-evaluating a live cert when bar is not met keeps cert live (no demotion)', async () => {
    const { em, forkedEm, cert } = makeEm('live')
    const queryStats = vi.fn().mockResolvedValue(makeMetStats(false))

    const service = new CertPromotionService(em, queryStats, makeConfig())
    await service.evaluateAndPromote('cert-1')

    expect(cert!.state).toBe('live')
    expect(forkedEm.flush).not.toHaveBeenCalled()
  })

  it('does nothing when cert is not found', async () => {
    const { em, forkedEm } = makeEm(null)
    const queryStats = vi.fn().mockResolvedValue(makeMetStats(true))

    const service = new CertPromotionService(em, queryStats, makeConfig())
    await expect(service.evaluateAndPromote('missing-cert')).resolves.toBeUndefined()
    expect(forkedEm.flush).not.toHaveBeenCalled()
    expect(queryStats).not.toHaveBeenCalled()
  })

  it('uses configured thresholds from env: overridden minChunks=5 makes 5-chunk domain pass', async () => {
    const { em, forkedEm, cert } = makeEm('draft')
    const queryStats = vi.fn().mockResolvedValue({
      // 5 chunks, totalChunks=50 → with minChunks=5 and totalMultiple=3, totalThreshold=30
      // 50 >= 30 ✓, 5 >= 5 ✓, enabledSources=1 ✓ → met
      domains: [{ name: 'Security', chunkCount: 5, enabledSourceCount: 1 }],
      totalChunks: 50,
    } as CoverageStats)

    const service = new CertPromotionService(em, queryStats, makeConfig(5, 3))
    await service.evaluateAndPromote('cert-1')

    expect(cert!.state).toBe('live')
    expect(forkedEm.flush).toHaveBeenCalled()
  })
})
