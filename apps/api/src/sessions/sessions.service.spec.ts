import { EntityManager, MikroORM } from '@mikro-orm/core'
import { Certification, SessionItem, User, UserCertification } from '@readion/db'
import mikroOrmConfig from '@readion/db/src/mikro-orm.config'
import { startPostgresContainer } from '@readion/db/src/test-helpers/containers'
import { acquireIsolatedDatabase } from '@readion/db/src/test-helpers/isolated-db'
import type { StartedTestContainer } from 'testcontainers'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuizService } from '../quiz/quiz.service'
import type { WeakAreasService } from '../weak-areas/weak-areas.service'
import type { ReadingBlockComposerService } from './reading-block-composer.service'
import type { SessionFillQueueService } from './session-fill-queue.service'
import { SessionsService } from './sessions.service'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const CERT_ID = '00000000-0000-4000-8000-000000000002'
const CERT_ID_2 = '00000000-0000-4000-8000-000000000009'
const ENROLLMENT_ID = '00000000-0000-4000-8000-000000000003'
const CHUNK_ID_1 = '00000000-0000-4000-8000-000000000011'
const CHUNK_ID_2 = '00000000-0000-4000-8000-000000000012'

const MOCK_READING_BLOCK = {
  markdown: '## Security Basics\n\nKey concepts.',
  tldr: ['Point 1', 'Point 2'],
  sourceChunkIds: [CHUNK_ID_1],
  supportingSpans: ['Key concepts'],
}

function makeWeakAreas(): WeakAreasService {
  return {
    listForEnrollment: vi.fn().mockResolvedValue([
      {
        id: 'wa-1',
        domain: 'Security',
        score: 0.3,
        accuracy: 0.5,
        meanConfidence: 0.5,
        responseCount: 3,
      },
      {
        id: 'wa-2',
        domain: 'Networking',
        score: 0.7,
        accuracy: 0.7,
        meanConfidence: 0.7,
        responseCount: 3,
      },
    ]),
  } as unknown as WeakAreasService
}

function makeComposer(): ReadingBlockComposerService {
  return {
    compose: vi.fn().mockResolvedValue(MOCK_READING_BLOCK),
    goDeeper: vi.fn().mockResolvedValue('## Expanded Content\n\nMore detail here.'),
  } as unknown as ReadingBlockComposerService
}

function makeQuiz(): QuizService {
  return {
    generate: vi.fn().mockResolvedValue({
      type: 'question',
      data: {
        id: 'quiz-key-1',
        format: 'multiple_choice',
        question: 'Which service provides compute?',
        options: ['EC2', 'S3', 'RDS', 'VPC'],
        provenance: {
          sourceChunkIds: [CHUNK_ID_1],
          supportingSpans: ['EC2 provides compute'],
          verdict: { pass: true, score: 0.9, distractorFindings: [] },
          score: 0.9,
        },
      },
    }),
  } as unknown as QuizService
}

function makeFillQueue(): SessionFillQueueService & {
  enqueued: Array<{ sessionId: string; startFromIndex: number }>
} {
  const enqueued: Array<{ sessionId: string; startFromIndex: number }> = []
  return {
    enqueued,
    enqueueSessionFill: vi
      .fn()
      .mockImplementation(async (sessionId: string, startFromIndex: number) => {
        enqueued.push({ sessionId, startFromIndex })
      }),
  } as unknown as SessionFillQueueService & {
    enqueued: Array<{ sessionId: string; startFromIndex: number }>
  }
}

describe('SessionsService (integration)', () => {
  let container: StartedTestContainer
  let orm: MikroORM
  let em: EntityManager
  let service: SessionsService
  let fillQueue: ReturnType<typeof makeFillQueue>

  beforeAll(async () => {
    container = await startPostgresContainer()
    await acquireIsolatedDatabase()
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      host: container.getHost(),
      port: container.getMappedPort(5432),
      dbName: process.env.DB_NAME ?? 'readion_test',
    })
    await orm.migrator.up()
    em = orm.em

    await seedRequiredRows(em)
  }, 120_000)

  afterAll(async () => {
    await orm?.close()
    await container?.stop()
  })

  beforeEach(async () => {
    await em.getConnection().execute('TRUNCATE TABLE session_items, study_sessions CASCADE')
    fillQueue = makeFillQueue()
    service = new SessionsService(em, makeWeakAreas(), makeComposer(), makeQuiz(), fillQueue)
  })

  describe('create', () => {
    it('returns 201 and creates an active session with first 3 items', async () => {
      const { session, statusCode } = await service.create(USER_ID, ENROLLMENT_ID, {
        durationMinutes: 30,
        contentMix: 'balanced',
        difficulty: 'intermediate',
        focusArea: { mode: 'auto' },
        learningStyle: 'weak-area-focus',
      })

      expect(statusCode).toBe(201)
      expect(session.status).toBe('active')
      expect(session.kind).toBe('study')
      expect(session.lastItemIndex).toBe(0)

      const items = await em
        .fork()
        .find(SessionItem, { session: session.id }, { orderBy: { index: 'ASC' } })
      expect(items.length).toBe(3)
      expect(items[0]!.type).toBe('reading')
      expect(items[1]!.type).toBe('quiz')
      expect(items[0]!.domain).toBe('Security')
      expect(items[1]!.domain).toBe('Security')
    })

    it('enqueues background fill for items beyond the first 3', async () => {
      const { session } = await service.create(USER_ID, ENROLLMENT_ID, {
        durationMinutes: 30,
        contentMix: 'balanced',
      })

      expect(fillQueue.enqueued).toHaveLength(1)
      expect(fillQueue.enqueued[0]!.sessionId).toBe(session.id)
      expect(fillQueue.enqueued[0]!.startFromIndex).toBe(3)
    })

    it('falls back to session config defaults when params omitted', async () => {
      const { session, statusCode } = await service.create(USER_ID, ENROLLMENT_ID, {})

      expect(statusCode).toBe(201)
      expect(session.durationMinutes).toBe(30)
      expect(session.contentMix).toBe('balanced')
      expect(session.difficulty).toBe('intermediate')
    })

    it('returns 200 and the existing session when one is already active', async () => {
      const first = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })
      expect(first.statusCode).toBe(201)

      const second = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 60 })

      expect(second.statusCode).toBe(200)
      expect(second.session.id).toBe(first.session.id)
    })

    it('two enrollments have independent sessions', async () => {
      const enrollment2 = await seedSecondEnrollment(em)
      const s1 = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })
      const s2 = await service.create(USER_ID, enrollment2, { durationMinutes: 30 })

      expect(s1.statusCode).toBe(201)
      expect(s2.statusCode).toBe(201)
      expect(s1.session.id).not.toBe(s2.session.id)
    })
  })

  describe('completeItem', () => {
    it('advances lastItemIndex to the next incomplete item', async () => {
      const { session } = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })

      await service.completeItem(USER_ID, session.id, 0)

      const updated = await service.findOne(USER_ID, session.id)
      expect(updated.lastItemIndex).toBe(1)
    })
  })

  describe('end', () => {
    it('marks a session as partial when only some items completed', async () => {
      const { session } = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })
      await service.completeItem(USER_ID, session.id, 0)

      const ended = await service.end(USER_ID, session.id)

      expect(ended.status).toBe('partial')
      expect(ended.endedAt).not.toBeNull()
    })

    it('marks a session as completed when all items are completed', async () => {
      const { session } = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })
      const items = await em.fork().find(SessionItem, { session: session.id })
      for (const item of items) {
        await service.completeItem(USER_ID, session.id, item.index)
      }

      const ended = await service.end(USER_ID, session.id)

      expect(ended.status).toBe('completed')
    })

    it('is idempotent — calling end twice returns the same status', async () => {
      const { session } = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })
      await service.end(USER_ID, session.id)
      const second = await service.end(USER_ID, session.id)

      expect(['partial', 'abandoned']).toContain(second.status)
    })
  })

  describe('goDeeper', () => {
    it('returns expanded content for a reading item', async () => {
      const { session } = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })

      const expanded = await service.goDeeper(USER_ID, session.id, 0)

      expect(typeof expanded).toBe('string')
      expect(expanded.length).toBeGreaterThan(0)
    })
  })

  describe('list', () => {
    it('returns only sessions for the requesting user', async () => {
      await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })

      const result = await service.list(USER_ID, {})

      expect(result.items.length).toBe(1)
      expect(result.meta.total).toBe(1)
    })

    it('filters by status', async () => {
      const { session } = await service.create(USER_ID, ENROLLMENT_ID, { durationMinutes: 30 })
      await service.end(USER_ID, session.id)

      const activeResult = await service.list(USER_ID, { status: 'active' })
      const endedResult = await service.list(USER_ID, { status: 'abandoned' })

      expect(activeResult.items).toHaveLength(0)
      expect(endedResult.items.length).toBeGreaterThanOrEqual(1)
    })
  })
})

async function seedRequiredRows(em: EntityManager) {
  const conn = em.fork()
  const fork = conn.fork()

  const user = fork.create(User, {
    id: USER_ID,
    email: 'sessions-test@example.com',
    passwordHash: '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
  })
  fork.persist(user)

  const cert = fork.create(Certification, {
    id: CERT_ID,
    name: 'Test Cert',
    provider: 'AWS',
    code: 'TEST-01',
    domains: [
      { name: 'Security', weight: 60 },
      { name: 'Networking', weight: 40 },
    ],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: 'verified',
    state: 'live',
  })
  fork.persist(cert)

  await fork.flush()

  const fork2 = em.fork()
  const enrollment = fork2.create(UserCertification, {
    id: ENROLLMENT_ID,
    user: fork2.getReference(User, USER_ID),
    certification: fork2.getReference(Certification, CERT_ID),
    status: 'active',
    enrolledAt: new Date(),
  })
  fork2.persist(enrollment)
  await fork2.flush()

  // Seed content chunks
  const vectorLiteral = `[${new Array(1536).fill(0.1).join(',')}]`
  const conn2 = em.getConnection()

  const sourceResult = await conn2.execute<{ id: string }[]>(
    `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'web', 'https://example.com/1', 60, now(), now())
     RETURNING id`,
    [CERT_ID],
  )
  const sourceId = sourceResult[0]!.id

  await conn2.execute(
    `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
     VALUES (?, ?, ?, 'Security fundamentals and key concepts', ?, ?::vector, ?::jsonb, 'Security', '{}', 'active', now(), now()),
            (?, ?, ?, 'Networking basics and configurations', ?, ?::vector, ?::jsonb, 'Networking', '{}', 'active', now(), now())`,
    [
      CHUNK_ID_1,
      sourceId,
      CERT_ID,
      'hash-1',
      vectorLiteral,
      JSON.stringify([{ domain: 'Security', confidence: 1.0 }]),
      CHUNK_ID_2,
      sourceId,
      CERT_ID,
      'hash-2',
      vectorLiteral,
      JSON.stringify([{ domain: 'Networking', confidence: 1.0 }]),
    ],
  )
}

async function seedSecondEnrollment(em: EntityManager): Promise<string> {
  const fork = em.fork()
  const cert2 = fork.create(Certification, {
    id: CERT_ID_2,
    name: 'Test Cert 2',
    provider: 'Azure',
    code: 'TEST-02',
    domains: [{ name: 'Security', weight: 100 }],
    questionCount: 50,
    passingScore: 700,
    timeLimitMinutes: 90,
    provenance: 'verified',
    state: 'live',
  })
  fork.persist(cert2)
  await fork.flush()

  const fork2 = em.fork()
  const conn = fork2.getConnection()
  const result = await conn.execute<{ id: string }[]>(
    `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now())
     RETURNING id`,
    [USER_ID, CERT_ID_2],
  )
  return result[0]!.id
}
