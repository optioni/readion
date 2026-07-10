import { NoObjectGeneratedError } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { SessionItemGeneratorService } from './session-item-generator.service'

const VALID_READING_JSON = JSON.stringify({
  markdown: '## Topic\nSome content.',
  tldr: ['Bullet one'],
  supportingSpans: ['key phrase'],
})

const VALID_QUIZ_JSON = JSON.stringify({
  question: 'What is X?',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
  supportingSpans: ['span one'],
  sourceChunkIds: ['chunk-1'],
})

const CHUNK_ROWS = [{ id: 'chunk-1', text: 'Content about the topic', primary_domain: 'Security' }]

function makeEm(chunkRows: typeof CHUNK_ROWS = CHUNK_ROWS) {
  const persist = vi.fn()
  const flush = vi.fn().mockResolvedValue(undefined)
  const getReference = vi.fn().mockReturnValue({ id: 'session-id' })
  const create = vi.fn().mockImplementation((_entity, data) => data)
  const execute = vi.fn().mockResolvedValue(chunkRows)
  const getConnection = vi.fn().mockReturnValue({ execute })

  const forkedEm = { persist, flush, getReference, create, getConnection }
  const em = { fork: vi.fn().mockReturnValue(forkedEm) }

  return { em, forkedEm, execute }
}

// Mirrors generateStructured: valid JSON resolves as the parsed object; invalid
// JSON rejects with a NoObjectGeneratedError carrying the raw text, exactly as
// Output.object does when the model returns something unparseable.
function makeLlm(response: string) {
  return {
    generateStructured: vi.fn().mockImplementation(async () => {
      try {
        return JSON.parse(response)
      } catch {
        throw new NoObjectGeneratedError({
          message: 'no object generated',
          text: response,
          response: { id: 'r', timestamp: new Date(0), modelId: 'mock' },
          usage: {
            inputTokens: undefined,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokens: undefined,
            outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
            totalTokens: undefined,
          },
          finishReason: 'stop',
        })
      }
    }),
  }
}

describe('SessionItemGeneratorService', () => {
  const SESSION_ID = 'session-uuid'
  const CERT_ID = 'cert-uuid'

  describe('generateItems()', () => {
    it('generates reading and quiz items for each plan entry', async () => {
      const { em, forkedEm } = makeEm()
      const llm = makeLlm(VALID_READING_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      await service.generateItems(
        SESSION_ID,
        [
          { index: 0, type: 'reading', domain: 'Security' },
          { index: 1, type: 'quiz', domain: 'Security', format: 'multiple_choice' },
        ],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      expect(llm.generateStructured).toHaveBeenCalledTimes(2)
      expect(forkedEm.persist).toHaveBeenCalledTimes(2)
      expect(forkedEm.flush).toHaveBeenCalledTimes(1)

      const readingItem = forkedEm.create.mock.calls[0]?.[1]
      const quizItem = forkedEm.create.mock.calls[1]?.[1]
      expect(readingItem?.domain).toBe('Security')
      expect(quizItem?.domain).toBe('Security')
    })

    it('persists fallback reading item when generation fails', async () => {
      const { em, forkedEm, execute } = makeEm([])
      const llm = makeLlm(VALID_READING_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      execute.mockResolvedValue([])

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'reading', domain: 'Security' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      expect(forkedEm.persist).toHaveBeenCalledTimes(1)
      const created = forkedEm.create.mock.calls[0]?.[1]
      expect(created?.content).toContain('Content for this domain is being prepared')
      expect(created?.domain).toBe('Security')
      expect(forkedEm.flush).toHaveBeenCalledTimes(1)
    })

    it('persists fallback quiz item when generation fails', async () => {
      const { em, forkedEm, execute } = makeEm([])
      const llm = makeLlm(VALID_QUIZ_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      execute.mockResolvedValue([])

      await service.generateItems(
        SESSION_ID,
        [{ index: 1, type: 'quiz', domain: 'Security' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      expect(forkedEm.persist).toHaveBeenCalledTimes(1)
      const created = forkedEm.create.mock.calls[0]?.[1]
      expect(created?.content).toContain('"insufficient":true')
      expect(created?.domain).toBe('Security')
    })
  })

  describe('reading item generation', () => {
    it('uses video type filter when contentMix is video-based', async () => {
      const { em, execute } = makeEm()
      const llm = makeLlm(VALID_READING_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      execute.mockResolvedValue(CHUNK_ROWS)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'reading', domain: 'Security' }],
        CERT_ID,
        'intermediate',
        'video-based',
      )

      const firstCall = execute.mock.calls[0]
      const [sql, params] = firstCall
      expect(sql).toContain("metadata->>'type'")
      expect(params).toContain('video')
    })

    it('retries without type filter when no video chunks found', async () => {
      const { em, execute } = makeEm()
      const llm = makeLlm(VALID_READING_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      execute.mockResolvedValueOnce([]).mockResolvedValueOnce(CHUNK_ROWS)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'reading', domain: 'Security' }],
        CERT_ID,
        'intermediate',
        'video-based',
      )

      expect(execute).toHaveBeenCalledTimes(2)
      const secondCall = execute.mock.calls[1]
      const params = secondCall[1]
      expect(params).not.toContain('video')
    })

    it('persists raw text when LLM response is not valid JSON', async () => {
      const { em, forkedEm } = makeEm()
      const llm = makeLlm('This is not JSON')
      const service = new SessionItemGeneratorService(em as any, llm as any)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'reading', domain: 'Security' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      const created = forkedEm.create.mock.calls[0]?.[1]
      expect(created?.content).toBe('This is not JSON')
      expect(created?.domain).toBe('Security')
    })

    it('uses the difficulty level in the prompt', async () => {
      const { em } = makeEm()
      const llm = makeLlm(VALID_READING_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'reading', domain: 'Security' }],
        CERT_ID,
        'exam-ready',
        'balanced',
      )

      expect(llm.generateStructured).toHaveBeenCalledWith(
        expect.stringContaining('exam-ready'),
        expect.anything(),
      )
    })
  })

  describe('quiz item generation', () => {
    it('persists structured quiz content on valid LLM response', async () => {
      const { em, forkedEm } = makeEm()
      const llm = makeLlm(VALID_QUIZ_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'quiz', domain: 'Security', format: 'multiple_choice' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      const created = forkedEm.create.mock.calls[0]?.[1]
      const content = JSON.parse(created?.content as string)
      expect(content.question).toBe('What is X?')
      expect(content.format).toBe('multiple_choice')
      expect(created?.domain).toBe('Security')
    })

    it('defaults format to multiple_choice when not specified', async () => {
      const { em, forkedEm } = makeEm()
      const llm = makeLlm(VALID_QUIZ_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'quiz', domain: 'Security' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      const created = forkedEm.create.mock.calls[0]?.[1]
      const content = JSON.parse(created?.content as string)
      expect(content.format).toBe('multiple_choice')
    })

    it('includes the format label in the LLM prompt', async () => {
      const { em } = makeEm()
      const llm = makeLlm(VALID_QUIZ_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'quiz', domain: 'Security', format: 'true_false' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      expect(llm.generateStructured).toHaveBeenCalledWith(
        expect.stringContaining('true-false'),
        expect.anything(),
      )
    })

    it('falls back to placeholder when LLM returns malformed content', async () => {
      const { em, forkedEm } = makeEm()
      const llm = makeLlm('not json')
      const service = new SessionItemGeneratorService(em as any, llm as any)

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'quiz', domain: 'Security' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      const created = forkedEm.create.mock.calls[0]?.[1]
      expect(created?.content).toContain('"insufficient":true')
    })
  })

  describe('fallback items', () => {
    it('reading fallback contains domain name', async () => {
      const { em, forkedEm, execute } = makeEm()
      const llm = makeLlm(VALID_READING_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      execute.mockResolvedValue([])

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'reading', domain: 'Kubernetes' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      const created = forkedEm.create.mock.calls[0]?.[1]
      expect(created?.content).toContain('Kubernetes')
      expect(created?.type).toBe('reading')
      expect(created?.domain).toBe('Kubernetes')
    })

    it('quiz fallback has insufficient flag with domain', async () => {
      const { em, forkedEm, execute } = makeEm()
      const llm = makeLlm(VALID_QUIZ_JSON)
      const service = new SessionItemGeneratorService(em as any, llm as any)

      execute.mockResolvedValue([])

      await service.generateItems(
        SESSION_ID,
        [{ index: 0, type: 'quiz', domain: 'Kubernetes' }],
        CERT_ID,
        'intermediate',
        'balanced',
      )

      const created = forkedEm.create.mock.calls[0]?.[1]
      const content = JSON.parse(created?.content as string)
      expect(content.insufficient).toBe(true)
      expect(content.domain).toBe('Kubernetes')
      expect(created?.domain).toBe('Kubernetes')
    })
  })
})
