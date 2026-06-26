import { EntityManager } from '@mikro-orm/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { createDbHarness, DbModule, type DbHarness } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerConfigModule } from '../config/config.module'
import { LlmService } from '../llm/llm.service'
import { MockExamWorkerGenerationService } from './mock-exam-worker-generation.service'

const MOCK_QUESTION_JSON = JSON.stringify({
  question: 'What is the primary concept in this domain?',
  options: ['key concepts', 'Option B', 'Option C', 'Option D'],
  correctAnswer: 'key concepts',
  supportingSpans: ['key concepts, best practices'],
  sourceChunkIds: [],
})

const CERT_ID = '00000000-0000-4000-8000-000000000001'
const USER_ID = '00000000-0000-4000-8000-000000000002'

describe('MockExamWorkerGenerationService (integration)', () => {
  let dbHarness: DbHarness
  let moduleRef: TestingModule
  let service: MockExamWorkerGenerationService
  let em: EntityManager

  const mockLlmService = {
    generateContent: vi.fn().mockResolvedValue(MOCK_QUESTION_JSON),
  }

  beforeAll(async () => {
    dbHarness = await createDbHarness()

    process.env.DATABASE_URL = `postgresql://readion:readion@${process.env.DB_HOST}:${process.env.DB_PORT}/readion_test`
    process.env.DB_USER = 'readion'
    process.env.DB_PASSWORD = 'readion'

    moduleRef = await Test.createTestingModule({
      imports: [WorkerConfigModule, DbModule],
      providers: [
        MockExamWorkerGenerationService,
        { provide: LlmService, useValue: mockLlmService },
      ],
    }).compile()

    await moduleRef.init()

    service = moduleRef.get(MockExamWorkerGenerationService)
    em = moduleRef.get(EntityManager)
  }, 120_000)

  afterAll(async () => {
    await moduleRef?.close()
    await dbHarness?.teardown()
  })

  beforeEach(async () => {
    mockLlmService.generateContent.mockResolvedValue(MOCK_QUESTION_JSON)
    await dbHarness.resetState()
    await seedRequiredFkRows(em)
  })

  it('leaves startedAt and deadline null before generation runs', async () => {
    const attemptId = await seedAttempt(em)

    const rows = await em.fork().getConnection().execute<{ started_at: unknown; deadline: unknown; questions: unknown }[]>(
      `SELECT started_at, deadline, questions FROM mock_exams WHERE id = ?`,
      [attemptId],
    )
    expect(rows[0]?.started_at).toBeNull()
    expect(rows[0]?.deadline).toBeNull()
    expect(rows[0]?.questions).toEqual([])
  })

  it('fills the full question set and stamps startedAt + deadline on completion', async () => {
    const attemptId = await seedAttempt(em)

    await service.generateAndStamp(attemptId)

    const rows = await em.fork().getConnection().execute<{
      started_at: string | null
      deadline: string | null
      questions: string
    }[]>(
      `SELECT started_at, deadline, questions FROM mock_exams WHERE id = ?`,
      [attemptId],
    )

    const row = rows[0]!
    expect(row.started_at).not.toBeNull()
    expect(row.deadline).not.toBeNull()

    const questions = typeof row.questions === 'string'
      ? JSON.parse(row.questions)
      : row.questions as unknown[]
    expect(questions).toHaveLength(4)

    const startedAtMs = new Date(row.started_at!).getTime()
    const deadlineMs = new Date(row.deadline!).getTime()
    expect(deadlineMs).toBeGreaterThan(startedAtMs)
    expect(deadlineMs - startedAtMs).toBe(10 * 60 * 1000)
  })

  it('stamps deadline only once all slots are filled (incremental persist does not set deadline early)', async () => {
    let callCount = 0
    mockLlmService.generateContent.mockImplementation(async () => {
      callCount++
      if (callCount < 4) {
        const interimRows = await em.fork().getConnection().execute<{ deadline: unknown }[]>(
          `SELECT deadline FROM mock_exams WHERE id IN (SELECT id FROM mock_exams LIMIT 1)`,
        )
        expect(interimRows[0]?.deadline).toBeNull()
      }
      return MOCK_QUESTION_JSON
    })

    const attemptId = await seedAttempt(em)
    await service.generateAndStamp(attemptId)

    const rows = await em.fork().getConnection().execute<{ deadline: string | null }[]>(
      `SELECT deadline FROM mock_exams WHERE id = ?`,
      [attemptId],
    )
    expect(rows[0]?.deadline).not.toBeNull()
  })
})

async function seedRequiredFkRows(em: EntityManager): Promise<void> {
  const conn = em.fork().getConnection()
  await conn.execute(
    `INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
     VALUES (?, 'worker-gen-test@example.com', 'hash', true, now(), now())
     ON CONFLICT DO NOTHING`,
    [USER_ID],
  )
  await conn.execute(
    `INSERT INTO certifications
       (id, name, code, provider, state, domains, question_count, passing_score, time_limit_minutes, provenance, created_at, updated_at)
     VALUES (?, 'Test Cert', 'TST-01', 'AWS', 'live',
       '[{"name":"Security","weight":50},{"name":"Networking","weight":50}]'::jsonb,
       4, 700, 10, '"verified"'::jsonb, now(), now())
     ON CONFLICT DO NOTHING`,
    [CERT_ID],
  )
  await conn.execute(
    `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now())`,
    [USER_ID, CERT_ID],
  )
  for (const domain of ['Security', 'Security', 'Networking', 'Networking']) {
    await conn.execute(
      `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, 'web', ?, 60, now(), now())`,
      [CERT_ID, `https://test.example.com/${Math.random()}`],
    )
    const sourceResult = await conn.execute<{ id: string }[]>(
      `SELECT id FROM content_sources WHERE certification_id = ? ORDER BY created_at DESC LIMIT 1`,
      [CERT_ID],
    )
    const sourceId = sourceResult[0]!.id
    const vectorLiteral = `[${new Array(1536).fill(0.1).join(',')}]`
    await conn.execute(
      `INSERT INTO content_chunks
         (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?::jsonb, ?, '{}', 'active', now(), now())`,
      [
        sourceId,
        CERT_ID,
        `Study content for ${domain}: key concepts, best practices, and real-world examples.`,
        `hash-${Math.random()}`,
        vectorLiteral,
        JSON.stringify([{ domain, confidence: 1.0 }]),
        domain,
      ],
    )
  }
}

async function seedAttempt(em: EntityManager): Promise<string> {
  const conn = em.fork().getConnection()
  const enrollmentResult = await conn.execute<{ id: string }[]>(
    `SELECT id FROM user_certifications WHERE user_id = ? AND certification_id = ? LIMIT 1`,
    [USER_ID, CERT_ID],
  )
  const enrollmentId = enrollmentResult[0]!.id

  const result = await conn.execute<{ id: string }[]>(
    `INSERT INTO mock_exams
       (id, user_id, user_certification_id, type, status, questions, domain_breakdown, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'mock', 'in_progress', '[]'::jsonb, '{}'::jsonb, now(), now())
     RETURNING id`,
    [USER_ID, enrollmentId],
  )
  return result[0]!.id
}
