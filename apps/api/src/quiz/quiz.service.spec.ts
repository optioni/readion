import { EntityManager, MikroORM } from '@mikro-orm/core'
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Certification,
  startPostgresContainer,
  startRedisContainer,
  User,
  UserCertification,
} from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { Provenance } from '@readion/shared'
import Redis from 'ioredis'
import type { Counter } from 'prom-client'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnvConfig } from '../config/env.schema'
import { GroundedGenerationService } from '../grounding/grounded-generation.service'
import { QuarantineService } from '../grounding/quarantine.service'
import { buildCacheKey } from '../llm/cache-key.builder'
import { EmbeddingService } from '../llm/embedding.service'
import type { LlmService } from '../llm/llm.service'
import { LlmResponseCacheService } from '../llm/llm-response-cache.service'
import { QuizService } from './quiz.service'

const CERT_ID = '00000000-0000-4000-8000-000000000001'
const CHUNK_ID_1 = '00000000-0000-4000-8000-000000000011'
const CHUNK_ID_2 = '00000000-0000-4000-8000-000000000012'

const FIXTURE_PROVENANCE: Provenance = {
  sourceChunkIds: [CHUNK_ID_1],
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  verdict: { pass: true, score: 0.95, distractorFindings: [] },
  score: 0.95,
}

const FIXTURE_ITEM = {
  question: 'What does Amazon EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS resolution', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  sourceChunkIds: [CHUNK_ID_1],
}

function makeCacheKey(format = 'multiple_choice') {
  return buildCacheKey({
    certificationId: CERT_ID,
    chunkIds: [CHUNK_ID_1, CHUNK_ID_2],
    difficulty: 'beginner',
    format,
  })
}

function makeConfigService(): ConfigService<EnvConfig> {
  return {
    get: vi.fn((key: string) => {
      const vals: Record<string, unknown> = { AI_RESPONSE_CACHE_TTL_SECONDS: 60 }
      return vals[key]
    }),
  } as unknown as ConfigService<EnvConfig>
}

function makeCounter(): Counter {
  return { inc: vi.fn() } as unknown as Counter
}

describe('QuizService (integration)', () => {
  let postgresContainer: StartedTestContainer
  let redisContainer: StartedTestContainer
  let redis: Redis
  let orm: MikroORM
  let em: EntityManager
  let cacheService: LlmResponseCacheService
  let groundedGeneration: GroundedGenerationService
  let quarantine: QuarantineService
  let embeddingService: EmbeddingService
  let llmService: LlmService
  let service: QuizService

  let certId: string
  let userId: string
  let enrollmentId: string

  beforeAll(async () => {
    ;[postgresContainer, redisContainer] = await Promise.all([
      startPostgresContainer(),
      startRedisContainer(),
    ])

    const dbHost = postgresContainer.getHost()
    const dbPort = postgresContainer.getMappedPort(5432)
    const redisHost = redisContainer.getHost()
    const redisPort = redisContainer.getMappedPort(6379)

    process.env.DATABASE_URL = `postgresql://readion:readion@${dbHost}:${dbPort}/readion_test`
    process.env.DB_HOST = dbHost
    process.env.DB_PORT = String(dbPort)
    process.env.DB_NAME = 'readion_test'
    process.env.DB_USER = 'readion'
    process.env.DB_PASSWORD = 'readion'
    process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`

    await acquireIsolatedDatabase()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: dbHost,
      port: dbPort,
      dbName: process.env.DB_NAME ?? 'readion_test',
    })
    await orm.migrator.up()
    em = orm.em

    redis = new Redis(`redis://${redisHost}:${redisPort}`)
    cacheService = new LlmResponseCacheService(redis, makeConfigService())
    quarantine = new QuarantineService(cacheService, makeCounter())

    embeddingService = {
      embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    } as unknown as EmbeddingService

    llmService = {
      generateText: vi.fn().mockResolvedValue({ text: JSON.stringify(FIXTURE_ITEM), usage: {} }),
    } as unknown as LlmService

    groundedGeneration = {
      generate: vi.fn().mockResolvedValue({
        success: true,
        item: FIXTURE_ITEM,
        provenance: FIXTURE_PROVENANCE,
        regenerations: 0,
      }),
      extractItemFromCache: vi.fn().mockReturnValue({
        item: FIXTURE_ITEM,
        provenance: FIXTURE_PROVENANCE,
      }),
    } as unknown as GroundedGenerationService

    service = new QuizService(
      em,
      groundedGeneration,
      quarantine,
      cacheService,
      embeddingService,
      llmService,
      { emitAsync: vi.fn().mockResolvedValue([]) } as unknown as EventEmitter2,
    )
  }, 120_000)

  afterAll(async () => {
    await redis.quit()
    await orm?.close()
    await postgresContainer?.stop()
    await redisContainer?.stop()
  })

  beforeEach(async () => {
    await redis.flushall()
    await orm.em
      .getConnection()
      .execute(`TRUNCATE TABLE quiz_responses, user_certifications, certifications, users CASCADE`)
    vi.clearAllMocks()

    const fork = em.fork()

    const user = fork.create(User, {
      email: 'quiz-user@example.com',
      passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
    })
    fork.persist(user)
    await fork.flush()
    userId = user.id

    const cert = fork.create(Certification, {
      name: 'AWS Certified Cloud Practitioner',
      provider: 'AWS',
      code: 'CLF-C02',
      domains: [{ name: 'Cloud Concepts', weight: 100 }],
      questionCount: 65,
      passingScore: 700,
      timeLimitMinutes: 90,
      provenance: 'verified',
      state: 'live',
    })
    fork.persist(cert)
    await fork.flush()
    certId = cert.id

    const enrollment = fork.create(UserCertification, {
      user: fork.getReference(User, userId),
      certification: fork.getReference(Certification, certId),
    })
    fork.persist(enrollment)
    await fork.flush()
    enrollmentId = enrollment.id

    ;(groundedGeneration.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      item: FIXTURE_ITEM,
      provenance: FIXTURE_PROVENANCE,
      regenerations: 0,
    })
    ;(groundedGeneration.extractItemFromCache as ReturnType<typeof vi.fn>).mockReturnValue({
      item: FIXTURE_ITEM,
      provenance: FIXTURE_PROVENANCE,
    })
    ;(embeddingService.embed as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Array(1536).fill(0.1),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generate (ownership + live-cert checks)', () => {
    it('throws NotFoundException when enrollment does not belong to user', async () => {
      await expect(
        service.generate('00000000-0000-4000-8000-000000000099', {
          userCertificationId: enrollmentId,
          domain: 'compute',
          difficulty: 'beginner',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('returns insufficient_material when no chunks exist for domain', async () => {
      const result = await service.generate(userId, {
        userCertificationId: enrollmentId,
        domain: 'compute',
        difficulty: 'beginner',
      })
      expect(result.type).toBe('insufficient_material')
    })

    it('returns insufficient_material for substitution signal from grounding service', async () => {
      const fork = em.fork()
      const conn = fork.getConnection()
      const [sourceRow] = await conn.execute<{ id: string }[]>(
        `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'web', 'https://test.example.com/sub', 60, now(), now()) RETURNING id`,
        [certId],
      )
      const vectorLiteral = `[${new Array(1536).fill(0.1).join(',')}]`
      await conn.execute(
        `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'EC2 test content', 'hash-sub-test', ?::vector, ?::jsonb, 'compute', '{}', 'active', now(), now())`,
        [
          sourceRow!.id,
          certId,
          vectorLiteral,
          JSON.stringify([{ domain: 'compute', confidence: 1.0 }]),
        ],
      )
      ;(groundedGeneration.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        signal: { type: 'substitution' },
      })

      const result = await service.generate(userId, {
        userCertificationId: enrollmentId,
        domain: 'compute',
        difficulty: 'beginner',
      })
      expect(result.type).toBe('insufficient_material')
    })

    it('throws UnprocessableEntityException when certification is not live', async () => {
      const fork = em.fork()
      const draftCert = fork.create(Certification, {
        name: 'Draft Cert',
        provider: 'AWS',
        code: 'DRAFT-01',
        domains: [{ name: 'Compute', weight: 100 }],
        questionCount: 65,
        passingScore: 700,
        timeLimitMinutes: 90,
        provenance: 'verified',
        state: 'draft',
      })
      fork.persist(draftCert)
      await fork.flush()

      const draftEnrollment = fork.create(UserCertification, {
        user: fork.getReference(User, userId),
        certification: fork.getReference(Certification, draftCert.id),
      })
      fork.persist(draftEnrollment)
      await fork.flush()

      await expect(
        service.generate(userId, {
          userCertificationId: draftEnrollment.id,
          domain: 'compute',
          difficulty: 'beginner',
        }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('returns insufficient_material with certificationId and domain when no chunks found', async () => {
      const result = await service.generate(userId, {
        userCertificationId: enrollmentId,
        domain: 'compute',
        difficulty: 'beginner',
      })

      expect(result.type).toBe('insufficient_material')
      if (result.type === 'insufficient_material') {
        expect(result.certificationId).toBe(certId)
        expect(result.domain).toBe('compute')
      }
    })
  })

  describe('submitAnswer (scoring + persistence)', () => {
    it('scores correct answer and persists QuizResponse', async () => {
      const cacheKey = makeCacheKey()
      await cacheService.set(cacheKey, [CHUNK_ID_1, CHUNK_ID_2], {
        text: JSON.stringify({
          item: FIXTURE_ITEM,
          provenance: FIXTURE_PROVENANCE,
          format: 'multiple_choice',
        }),
        usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
        verified: true,
      })

      const result = await service.submitAnswer(userId, cacheKey, {
        userCertificationId: enrollmentId,
        answer: 'Scalable computing capacity',
        confidence: 4,
        timeTakenMs: 10000,
      })

      expect(result.correct).toBe(true)
      expect(result.answer).toBe('Scalable computing capacity')
      expect(result.confidence).toBe(4)
      expect(result.timeTakenMs).toBe(10000)
      expect(result.userCertificationId).toBe(enrollmentId)
      expect(result.id).toBeDefined()
    })

    it('scores incorrect answer', async () => {
      const cacheKey = makeCacheKey()
      await cacheService.set(cacheKey, [CHUNK_ID_1, CHUNK_ID_2], {
        text: JSON.stringify({
          item: FIXTURE_ITEM,
          provenance: FIXTURE_PROVENANCE,
          format: 'multiple_choice',
        }),
        usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
        verified: true,
      })

      const result = await service.submitAnswer(userId, cacheKey, {
        userCertificationId: enrollmentId,
        answer: 'Object storage',
        confidence: 2,
        timeTakenMs: 5000,
      })

      expect(result.correct).toBe(false)
    })

    it('throws NotFoundException for missing enrollment', async () => {
      const cacheKey = makeCacheKey()

      await expect(
        service.submitAnswer('00000000-0000-4000-8000-000000000099', cacheKey, {
          userCertificationId: enrollmentId,
          answer: 'Scalable computing capacity',
          confidence: 3,
          timeTakenMs: 5000,
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws UnprocessableEntityException when question is expired (cache miss)', async () => {
      const expiredKey = 'expired-question-key'

      await expect(
        service.submitAnswer(userId, expiredKey, {
          userCertificationId: enrollmentId,
          answer: 'Scalable computing capacity',
          confidence: 3,
          timeTakenMs: 5000,
        }),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  describe('generateExplanation', () => {
    it('throws NotFoundException for missing enrollment', async () => {
      await expect(
        service.generateExplanation('00000000-0000-4000-8000-000000000099', 'some-key', {
          userCertificationId: enrollmentId,
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws UnprocessableEntityException when question is expired (cache miss)', async () => {
      await expect(
        service.generateExplanation(userId, 'expired-key', {
          userCertificationId: enrollmentId,
        }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws UnprocessableEntityException when source chunks are unavailable', async () => {
      const cacheKey = makeCacheKey()
      await cacheService.set(cacheKey, [CHUNK_ID_1, CHUNK_ID_2], {
        text: JSON.stringify({
          item: FIXTURE_ITEM,
          provenance: FIXTURE_PROVENANCE,
          format: 'multiple_choice',
        }),
        usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
        verified: true,
      })

      await expect(
        service.generateExplanation(userId, cacheKey, { userCertificationId: enrollmentId }),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  describe('reportQuestion (delegation to quarantine)', () => {
    it('throws UnprocessableEntityException when question is expired', async () => {
      await expect(
        service.reportQuestion(userId, 'expired-key', {
          userCertificationId: enrollmentId,
          reason: 'Incorrect answer key',
        }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws NotFoundException for missing enrollment', async () => {
      await expect(
        service.reportQuestion('00000000-0000-4000-8000-000000000099', 'some-key', {
          userCertificationId: enrollmentId,
          reason: 'Bad question',
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
