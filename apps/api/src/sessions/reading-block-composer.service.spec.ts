import type { EntityManager } from '@mikro-orm/core'
import type { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import type { LlmService } from '../llm/llm.service'
import { ReadingBlockComposerService } from './reading-block-composer.service'

type MockChunkRow = {
  id: string
  text: string
  primary_domain: string
  similarity: number
}

function makeChunkRow(id: string, similarity: number, domain = 'Security'): MockChunkRow {
  return { id, text: `Content for ${id}`, primary_domain: domain, similarity }
}

function makeLlm(
  object: unknown = {
    markdown: '## Overview\n\nSome content here.',
    tldr: ['Key point 1', 'Key point 2', 'Key point 3'],
    supportingSpans: ['some span'],
  },
) {
  return {
    generateObject: vi.fn().mockResolvedValue({
      object,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }),
  } as unknown as LlmService
}

function makeEm(rows: MockChunkRow[] = []) {
  const connection = {
    execute: vi.fn().mockResolvedValue(rows),
  }
  return {
    fork: vi.fn().mockReturnValue({ getConnection: () => connection }),
    getConnection: () => connection,
  } as unknown as EntityManager
}

function makeConfig(threshold = 0.75): ConfigService {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'GROUNDING_SIMILARITY_THRESHOLD') return threshold
      return undefined
    }),
  } as unknown as ConfigService
}

describe('ReadingBlockComposerService', () => {
  it('composes Markdown from retrieved chunks above the threshold', async () => {
    const chunks = [makeChunkRow('c1', 0.9), makeChunkRow('c2', 0.8)]
    const em = makeEm(chunks)
    const llm = makeLlm()
    const svc = new ReadingBlockComposerService(llm, em, makeConfig())

    const result = await svc.compose({
      domain: 'Security',
      certificationId: 'cert-1',
      difficulty: 'intermediate',
    })

    expect(result).not.toBeNull()
    expect(result!.markdown).toContain('Overview')
    expect(result!.tldr).toHaveLength(3)
    expect(result!.sourceChunkIds).toEqual(['c1', 'c2'])
  })

  it('discards chunks below the threshold', async () => {
    const chunks = [makeChunkRow('c1', 0.9), makeChunkRow('c2', 0.5)]
    const em = makeEm(chunks)
    const svc = new ReadingBlockComposerService(makeLlm(), em, makeConfig())

    const result = await svc.compose({
      domain: 'Security',
      certificationId: 'cert-1',
      difficulty: 'intermediate',
    })

    expect(result!.sourceChunkIds).toEqual(['c1'])
    expect(result!.sourceChunkIds).not.toContain('c2')
  })

  it('composes at most 3 chunks', async () => {
    const chunks = [
      makeChunkRow('c1', 0.95),
      makeChunkRow('c2', 0.9),
      makeChunkRow('c3', 0.85),
      makeChunkRow('c4', 0.8),
    ]
    const em = makeEm(chunks)
    const svc = new ReadingBlockComposerService(makeLlm(), em, makeConfig())

    const result = await svc.compose({
      domain: 'Security',
      certificationId: 'cert-1',
      difficulty: 'intermediate',
    })

    expect(result!.sourceChunkIds.length).toBeLessThanOrEqual(3)
  })

  it('returns null when all chunks are below the threshold', async () => {
    const chunks = [makeChunkRow('c1', 0.6), makeChunkRow('c2', 0.5)]
    const em = makeEm(chunks)
    const svc = new ReadingBlockComposerService(makeLlm(), em, makeConfig())

    const result = await svc.compose({
      domain: 'Security',
      certificationId: 'cert-1',
      difficulty: 'intermediate',
    })

    expect(result).toBeNull()
  })

  it('video-based mix falls back to reading block when no video-specific chunks exist', async () => {
    const connection = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeChunkRow('c1', 0.9)]),
    }
    const em = {
      fork: vi.fn().mockReturnValue({ getConnection: () => connection }),
    } as unknown as EntityManager

    const llm = makeLlm()
    const svc = new ReadingBlockComposerService(llm, em, makeConfig())

    const result = await svc.compose({
      domain: 'Security',
      certificationId: 'cert-1',
      difficulty: 'intermediate',
      preferVideo: true,
    })

    expect(result).not.toBeNull()
    expect(result?.markdown).toBeDefined()
  })

  it('captures supportingSpans from LLM output', async () => {
    const chunks = [makeChunkRow('c1', 0.9)]
    const em = makeEm(chunks)
    const llm = makeLlm({
      markdown: '## Security\n\nKey concepts.',
      tldr: ['Point 1', 'Point 2'],
      supportingSpans: ['span about security', 'another span'],
    })
    const svc = new ReadingBlockComposerService(llm, em, makeConfig())

    const result = await svc.compose({
      domain: 'Security',
      certificationId: 'cert-1',
      difficulty: 'intermediate',
    })

    expect(result?.supportingSpans).toContain('span about security')
  })

  describe('goDeeper', () => {
    it('generates expanded explanation using source chunks', async () => {
      const chunks = [makeChunkRow('c1', 0.9)]
      const llm = makeLlm({
        markdown: '## Deep Dive\n\nA very detailed explanation.',
        tldr: ['Detail 1', 'Detail 2'],
        supportingSpans: [],
      })
      const em = makeEm(chunks)
      const svc = new ReadingBlockComposerService(llm, em, makeConfig())

      const expanded = await svc.goDeeper({
        sourceChunkIds: ['c1'],
        originalContent: '## Overview\n\nBrief.',
        certificationId: 'cert-1',
      })

      expect(expanded).toContain('Deep Dive')
    })
  })
})
