import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { DomainTag } from '@readion/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmService } from '../../llm/llm.service'
import { DomainTaggerService } from './domain-tagger.service'

describe('DomainTaggerService', () => {
  let service: DomainTaggerService
  let llmService: { tagDomains: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    llmService = { tagDomains: vi.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DomainTaggerService,
        { provide: LlmService, useValue: llmService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'CONTENT_DOMAIN_CONFIDENCE_THRESHOLD') return 0.5
              return undefined
            },
          },
        },
      ],
    }).compile()

    service = moduleRef.get(DomainTaggerService)
  })

  afterEach(() => vi.restoreAllMocks())

  it('returns tags for qualifying domains from LLM response', async () => {
    const mockTags: DomainTag[] = [
      { domain: 'Security', confidence: 0.82 },
      { domain: 'Architecture', confidence: 0.61 },
    ]
    llmService.tagDomains.mockResolvedValue(mockTags)

    const result = await service.tag('some chunk text', ['Security', 'Architecture', 'Networking'])
    expect(result.tags).toEqual(mockTags)
    expect(result.primaryDomain).toBe('Security')
  })

  it('primaryDomain is the domain with the highest confidence', async () => {
    llmService.tagDomains.mockResolvedValue([
      { domain: 'Networking', confidence: 0.55 },
      { domain: 'Security', confidence: 0.91 },
      { domain: 'Architecture', confidence: 0.73 },
    ])

    const result = await service.tag('chunk text', ['Security', 'Architecture', 'Networking'])
    expect(result.primaryDomain).toBe('Security')
  })

  it('excludes domains below the configured confidence threshold', async () => {
    // LLM returns a tag below threshold; service should pass threshold to LLM
    llmService.tagDomains.mockResolvedValue([{ domain: 'Security', confidence: 0.91 }])

    const result = await service.tag('chunk text', ['Security', 'Networking'])
    expect(result.tags).toHaveLength(1)
    expect(result.tags[0].domain).toBe('Security')
  })

  it('multi-domain chunk yields entries for each qualifying domain', async () => {
    llmService.tagDomains.mockResolvedValue([
      { domain: 'Security', confidence: 0.82 },
      { domain: 'Architecture', confidence: 0.61 },
    ])

    const result = await service.tag('chunk text', ['Security', 'Architecture', 'Networking'])
    expect(result.tags).toHaveLength(2)
    expect(result.tags.map((t) => t.domain)).toContain('Security')
    expect(result.tags.map((t) => t.domain)).toContain('Architecture')
  })

  it('returns empty tags with null primaryDomain for empty LLM response', async () => {
    llmService.tagDomains.mockResolvedValue([])

    const result = await service.tag('chunk text', ['Security'])
    expect(result.tags).toHaveLength(0)
    expect(result.primaryDomain).toBeNull()
  })

  it('falls back to 0.5 threshold when config returns undefined', async () => {
    const { Test: NestTest } = await import('@nestjs/testing')
    const { ConfigService } = await import('@nestjs/config')
    const { LlmService: LocalLlmService } = await import('../../llm/llm.service')

    const mockLlm = {
      tagDomains: vi.fn().mockResolvedValue([{ domain: 'Security', confidence: 0.6 }]),
    }

    const moduleRef = await NestTest.createTestingModule({
      providers: [
        DomainTaggerService,
        { provide: LocalLlmService, useValue: mockLlm },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(undefined) } },
      ],
    }).compile()

    const svc = moduleRef.get(DomainTaggerService)
    const result = await svc.tag('text', ['Security'])
    expect(result.primaryDomain).toBe('Security')
    expect(mockLlm.tagDomains).toHaveBeenCalledWith('text', ['Security'], 0.5)
  })
})
