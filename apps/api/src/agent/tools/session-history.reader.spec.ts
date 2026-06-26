import { createDbHarness, type DbHarness } from '@readion/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SessionHistoryReader } from './session-history.reader'

async function seedUser(harness: DbHarness, email: string): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'hash', 'user', now(), now())
     RETURNING id`,
    [email],
  )
  return rows[0]!.id
}

async function seedEnrollment(harness: DbHarness, userId: string, code: string): Promise<string> {
  const conn = harness.getEm().getConnection()
  const certRows = await conn.execute<{ id: string }[]>(
    `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
     VALUES (gen_random_uuid(), 'Cert', 'AWS', ?, '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
     RETURNING id`,
    [code],
  )
  const enrollRows = await conn.execute<{ id: string }[]>(
    `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now())
     RETURNING id`,
    [userId, certRows[0]!.id],
  )
  return enrollRows[0]!.id
}

async function seedChunk(
  harness: DbHarness,
  enrollmentId: string,
  certCode: string,
  domain: string,
): Promise<string> {
  const conn = harness.getEm().getConnection()
  const certRows = await conn.execute<{ certification_id: string }[]>(
    `SELECT certification_id FROM user_certifications WHERE id = ?`,
    [enrollmentId],
  )
  const certId = certRows[0]!.certification_id
  const sourceRows = await conn.execute<{ id: string }[]>(
    `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'web', ?, 60, now(), now())
     RETURNING id`,
    [certId, `https://test.example.com/${certCode}/${Math.random()}`],
  )
  const embedding = `[${new Array(1536).fill(0.1).join(',')}]`
  const chunkRows = await conn.execute<{ id: string }[]>(
    `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, embedding, domain_tags, primary_domain, metadata, state, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, ?, ?, ?::vector, ?::jsonb, ?, '{}', 'active', now(), now())
     RETURNING id`,
    [
      sourceRows[0]!.id,
      certId,
      `Content for ${domain}.`,
      `hash-${Math.random()}`,
      embedding,
      JSON.stringify([{ domain, confidence: 1.0 }]),
      domain,
    ],
  )
  return chunkRows[0]!.id
}

async function seedSession(
  harness: DbHarness,
  options: {
    enrollmentId: string
    userId: string
    startedAt: string
    endedAt: string | null
    status?: string
    kind?: string
  },
): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, ended_at, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, ?, ?, 30, 'balanced', 'intermediate', '{"mode":"auto"}'::jsonb, 'weak-area-focus', 0, ?, ?, now(), now())
     RETURNING id`,
    [
      options.enrollmentId,
      options.userId,
      options.kind ?? 'study',
      options.status ?? 'completed',
      options.startedAt,
      options.endedAt,
    ],
  )
  return rows[0]!.id
}

async function seedResponse(
  harness: DbHarness,
  options: {
    enrollmentId: string
    createdAt: string
    correct: boolean
    sourceChunkIds: string[]
  },
): Promise<void> {
  const conn = harness.getEm().getConnection()
  const snapshot = {
    question: 'Q?',
    options: ['a', 'b'],
    correctAnswer: 'a',
    provenance: {
      sourceChunkIds: options.sourceChunkIds,
      supportingSpans: ['span'],
      verdict: { pass: true, score: 1, distractorFindings: [] },
      score: 1,
    },
  }
  await conn.execute(
    `INSERT INTO quiz_responses (id, user_certification_id, answer, correct, confidence, time_taken_ms, question_snapshot, format, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'a', ?, 3, 1000, ?::jsonb, 'mcq', ?, now())`,
    [options.enrollmentId, options.correct, JSON.stringify(snapshot), options.createdAt],
  )
}

async function seedMock(
  harness: DbHarness,
  options: {
    enrollmentId: string
    userId: string
    status: string
    score: number
    updatedAt: string
  },
): Promise<void> {
  const conn = harness.getEm().getConnection()
  await conn.execute(
    `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, score, passed, domain_breakdown, questions, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'mock', ?, ?, ?, '{}'::jsonb, '[]'::jsonb, now(), ?)`,
    [
      options.userId,
      options.enrollmentId,
      options.status,
      options.score,
      options.score >= 70,
      options.updatedAt,
    ],
  )
}

describe('SessionHistoryReader', () => {
  let harness: DbHarness | undefined

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness?.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  function reader(): SessionHistoryReader {
    if (!harness) throw new Error('DB harness was not initialized')
    return new SessionHistoryReader(harness.getEm())
  }

  it('returns sessions newest-first and limited', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'order@example.com')
    const enrollmentId = await seedEnrollment(harness, userId, 'HIST-01')
    const older = await seedSession(harness, {
      enrollmentId,
      userId,
      startedAt: '2026-02-01T10:00:00Z',
      endedAt: '2026-02-01T11:00:00Z',
    })
    const newer = await seedSession(harness, {
      enrollmentId,
      userId,
      startedAt: '2026-02-02T10:00:00Z',
      endedAt: '2026-02-02T11:00:00Z',
    })

    const result = await reader().read(userId, enrollmentId, 1)

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]!.sessionId).toBe(newer)
    expect(result.sessions[0]!.sessionId).not.toBe(older)
    expect(result.mockExams).toEqual([])
  })

  it('computes per-domain accuracy from responses inside the session window', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'accuracy@example.com')
    const enrollmentId = await seedEnrollment(harness, userId, 'HIST-02')
    const chunkId = await seedChunk(harness, enrollmentId, 'HIST-02', 'Security')
    await seedSession(harness, {
      enrollmentId,
      userId,
      startedAt: '2026-03-01T10:00:00Z',
      endedAt: '2026-03-01T11:00:00Z',
    })
    await seedResponse(harness, {
      enrollmentId,
      createdAt: '2026-03-01T10:30:00Z',
      correct: true,
      sourceChunkIds: [chunkId],
    })
    await seedResponse(harness, {
      enrollmentId,
      createdAt: '2026-03-01T10:45:00Z',
      correct: false,
      sourceChunkIds: [chunkId],
    })
    // Outside the window: a correct response that must not skew the tally.
    await seedResponse(harness, {
      enrollmentId,
      createdAt: '2026-03-01T09:00:00Z',
      correct: true,
      sourceChunkIds: [chunkId],
    })

    const result = await reader().read(userId, enrollmentId, 10)

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]!.domains).toEqual([{ domain: 'Security', accuracy: 0.5 }])
  })

  it('uses now() as the window end for sessions that have not ended', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'open@example.com')
    const enrollmentId = await seedEnrollment(harness, userId, 'HIST-03')
    const chunkId = await seedChunk(harness, enrollmentId, 'HIST-03', 'Networking')
    await seedSession(harness, {
      enrollmentId,
      userId,
      startedAt: '2026-03-01T10:00:00Z',
      endedAt: null,
      status: 'active',
    })
    await seedResponse(harness, {
      enrollmentId,
      createdAt: '2026-03-01T10:30:00Z',
      correct: true,
      sourceChunkIds: [chunkId],
    })

    const result = await reader().read(userId, enrollmentId, 10)

    expect(result.sessions[0]!.endedAt).toBeNull()
    expect(result.sessions[0]!.domains).toEqual([{ domain: 'Networking', accuracy: 1 }])
  })

  it('maps submitted and expired mock exams newest-first', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'mocks@example.com')
    const enrollmentId = await seedEnrollment(harness, userId, 'HIST-04')
    await seedMock(harness, {
      enrollmentId,
      userId,
      status: 'submitted',
      score: 80,
      updatedAt: '2026-04-01T12:00:00Z',
    })
    await seedMock(harness, {
      enrollmentId,
      userId,
      status: 'expired',
      score: 50,
      updatedAt: '2026-04-02T12:00:00Z',
    })
    // in_progress mocks must be ignored entirely.
    await seedMock(harness, {
      enrollmentId,
      userId,
      status: 'in_progress',
      score: 0,
      updatedAt: '2026-04-03T12:00:00Z',
    })

    const result = await reader().read(userId, enrollmentId, 10)

    expect(result.mockExams).toHaveLength(2)
    const [expired, submitted] = result.mockExams
    expect(expired!.score).toBe(50)
    expect(expired!.submittedAt).toBeNull()
    expect(submitted!.score).toBe(80)
    expect(submitted!.submittedAt).not.toBeNull()
    expect(submitted!.submittedAt!.getTime()).toBe(new Date('2026-04-01T12:00:00Z').getTime())
  })

  it('returns empty mockExams when there are none', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'nomocks@example.com')
    const enrollmentId = await seedEnrollment(harness, userId, 'HIST-05')

    const result = await reader().read(userId, enrollmentId, 10)

    expect(result.mockExams).toEqual([])
    expect(result.sessions).toEqual([])
  })
})
