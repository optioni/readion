import type { EmbeddingModelV3Result, LanguageModelV3FinishReason } from '@ai-sdk/provider'
import type { EntityManager } from '@mikro-orm/core'
import type { MockExamGenerationJobPayload } from '@readion/shared'
import { MOCK_EXAM_GENERATION_QUEUE } from '@readion/shared'
import { MockEmbeddingModelV3, MockLanguageModelV3 } from 'ai/test'
import type { Job } from 'bullmq'
import type { StartedTestContainer } from 'testcontainers'
import { vi } from 'vitest'

export const CORRECT_ANSWER = 'key concepts'

/**
 * SUPPORTING_SPAN is a verbatim substring of every seeded chunk's text
 * ("Study content for <domain>: key concepts, best practices, and real-world examples.").
 * The extractive-contract validator requires both:
 *   - span-in-chunk: the span appears inside the source chunk text
 *   - answerBacked: CORRECT_ANSWER appears inside the span
 * Both conditions hold because CORRECT_ANSWER is a prefix of SUPPORTING_SPAN.
 */
export const SUPPORTING_SPAN = 'key concepts, best practices, and real-world examples.'

export const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }

export const PASS_VERDICT = JSON.stringify({
  pass: true,
  score: 1.0,
  distractorFindings: [
    { option: 'Option B', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option C', isCorrect: false, reason: 'Not supported by source material' },
    { option: 'Option D', isCorrect: false, reason: 'Not supported by source material' },
  ],
})

export function extractMessageText(prompt: Array<{ role: string; content: unknown }>): string {
  return prompt
    .flatMap((msg) => {
      if (Array.isArray(msg.content)) {
        return (msg.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
      }
      return [typeof msg.content === 'string' ? msg.content : '']
    })
    .join('\n')
}

export function buildMockQuestion(sourceChunkId: string): string {
  return JSON.stringify({
    question: 'What is the primary concept in this domain?',
    options: [CORRECT_ANSWER, 'Option B', 'Option C', 'Option D'],
    correctAnswer: CORRECT_ANSWER,
    supportingSpans: [SUPPORTING_SPAN],
    sourceChunkIds: [sourceChunkId],
  })
}

export function fakeJob(data: MockExamGenerationJobPayload): Job<MockExamGenerationJobPayload> {
  return {
    id: 'test-1',
    queueName: MOCK_EXAM_GENERATION_QUEUE,
    name: 'mock-exam-generation',
    data,
    opts: {},
    timestamp: Date.now(),
    attemptsMade: 0,
    stacktrace: [],
    returnvalue: null,
  } as Partial<Job<MockExamGenerationJobPayload>> as Job<MockExamGenerationJobPayload>
}

export async function truncateTables(em: EntityManager): Promise<void> {
  const fork = em.fork()
  const conn = fork.getConnection()
  const tables = await conn.execute<{ tablename: string }[]>(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'mikro_orm_migrations'
  `)
  if (tables.length === 0) return
  const names = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ')
  await conn.execute(`TRUNCATE TABLE ${names} CASCADE`)
  fork.clear()
}

export function configureTestEnv(
  postgresContainer: StartedTestContainer,
  redisContainer: StartedTestContainer,
): void {
  const dbHost = postgresContainer.getHost()
  const dbPort = postgresContainer.getMappedPort(5432)
  const redisHost = redisContainer.getHost()
  const redisPort = redisContainer.getMappedPort(6379)

  process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
  process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`
  process.env.DB_HOST = dbHost
  process.env.DB_PORT = String(dbPort)
  process.env.DB_NAME = 'readion_test'
  process.env.DB_USER = 'readion'
  process.env.DB_PASSWORD = 'readion'
  process.env.PORT = '0'
  process.env.NODE_ENV = 'test'
  process.env.CORS_ORIGIN = 'http://localhost:3000'
  process.env.MAIL_FROM = 'Readion <no-reply@readion.app>'
  process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters'
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS = '900'
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN_SECONDS = '604800'
  process.env.BCRYPT_COST = '4'
  process.env.WEB_BASE_URL = 'http://localhost:3000'
}

export function createMockEmbeddingModel(): MockEmbeddingModelV3 {
  return new MockEmbeddingModelV3({
    doEmbed: async ({ values }): Promise<EmbeddingModelV3Result> => ({
      embeddings: values.map(() => new Array(1536).fill(0.1)),
      usage: { tokens: values.length * 10 },
      warnings: [],
    }),
  })
}

export function createStandardMockLangModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async ({ prompt }: { prompt: Array<{ role: string; content: unknown }> }) => {
      const allText = extractMessageText(prompt)

      let text: string
      if (allText.includes('independent answer verifier') || allText.includes('Verify:')) {
        text = PASS_VERDICT
      } else {
        const chunkIdMatch = allText.match(
          /\[(?:Source: )?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/,
        )
        const sourceChunkId = chunkIdMatch?.[1] ?? '00000000-0000-0000-0000-000000000000'
        text = buildMockQuestion(sourceChunkId)
      }

      return {
        content: [{ type: 'text', text }],
        finishReason: FINISH_REASON_STOP,
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
}

export function createMockProviderValue(
  langModel: MockLanguageModelV3 = createStandardMockLangModel(),
  embeddingModel: MockEmbeddingModelV3 = createMockEmbeddingModel(),
): { getChatModel: ReturnType<typeof vi.fn>; getEmbeddingModel: ReturnType<typeof vi.fn> } {
  return {
    getChatModel: vi.fn().mockReturnValue(langModel),
    getEmbeddingModel: vi.fn().mockReturnValue(embeddingModel),
  }
}
