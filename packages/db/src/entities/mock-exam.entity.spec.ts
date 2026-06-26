import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDbHarness, type DbHarness } from '../test-helpers/db-harness'

async function seedUserAndEnrollment(
  harness: DbHarness,
): Promise<{ userId: string; enrollmentId: string }> {
  const conn = harness.getEm().getConnection()
  const rnd = Math.floor(Math.random() * 1e6)

  const userResult = await conn.execute<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES (gen_random_uuid(), 'mock-${rnd}@example.com', 'hash', 'user', now(), now())
     RETURNING id`,
  )
  const userId = userResult[0]!.id

  const certResult = await conn.execute<{ id: string }[]>(
    `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
     VALUES (gen_random_uuid(), 'Mock Cert', 'AWS', 'MOCK-${rnd}', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
     RETURNING id`,
  )
  const certId = certResult[0]!.id

  const enrollResult = await conn.execute<{ id: string }[]>(
    `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now())
     RETURNING id`,
    [userId, certId],
  )
  const enrollmentId = enrollResult[0]!.id

  return { userId, enrollmentId }
}

describe('MockExam entity', () => {
  let harness: DbHarness

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  beforeEach(async () => {
    await harness.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  it('migration creates the mock_exam table with all required columns', async () => {
    const conn = harness.getEm().getConnection()

    const rows = await conn.execute<{
      column_name: string
      data_type: string
      is_nullable: string
    }>(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'mock_exams'
      ORDER BY column_name
    `)
    const columns = Object.fromEntries(
      (rows as { column_name: string; data_type: string; is_nullable: string }[]).map((r) => [
        r.column_name,
        r,
      ]),
    )

    expect(columns['id']).toBeDefined()
    expect(columns['user_id']).toBeDefined()
    expect(columns['user_certification_id']).toBeDefined()
    expect(columns['type']).toBeDefined()
    expect(columns['status']).toBeDefined()
    expect(columns['started_at']).toBeDefined()
    expect(columns['started_at']!.is_nullable).toBe('YES')
    expect(columns['deadline']).toBeDefined()
    expect(columns['deadline']!.is_nullable).toBe('YES')
    expect(columns['score']).toBeDefined()
    expect(columns['passed']).toBeDefined()
    expect(columns['domain_breakdown']).toBeDefined()
    expect(columns['domain_breakdown']!.data_type).toBe('jsonb')
    expect(columns['questions']).toBeDefined()
    expect(columns['questions']!.data_type).toBe('jsonb')
  })

  it('migration creates FK constraints to users and user_certifications', async () => {
    const conn = harness.getEm().getConnection()

    const fkRows = await conn.execute<{ column_name: string; foreign_table_name: string }>(`
      SELECT kcu.column_name, ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'mock_exams'
        AND tc.constraint_type = 'FOREIGN KEY'
    `)

    const foreignTables = (fkRows as { column_name: string; foreign_table_name: string }[]).map(
      (r) => r.foreign_table_name,
    )
    expect(foreignTables).toContain('users')
    expect(foreignTables).toContain('user_certifications')
  })

  it('type enum accepts both mock and diagnostic values', async () => {
    const { userId, enrollmentId } = await seedUserAndEnrollment(harness)
    const conn = harness.getEm().getConnection()

    await expect(
      conn.execute(
        `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, questions, domain_breakdown, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'mock', 'in_progress', '[]'::jsonb, '{}'::jsonb, now(), now())`,
        [userId, enrollmentId],
      ),
    ).resolves.toBeDefined()

    await expect(
      conn.execute(
        `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, questions, domain_breakdown, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'diagnostic', 'in_progress', '[]'::jsonb, '{}'::jsonb, now(), now())`,
        [userId, enrollmentId],
      ),
    ).resolves.toBeDefined()
  })

  it('rejects an invalid type value', async () => {
    const { userId, enrollmentId } = await seedUserAndEnrollment(harness)
    const conn = harness.getEm().getConnection()

    await expect(
      conn.execute(
        `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, questions, domain_breakdown, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'bogus_type', 'in_progress', '[]'::jsonb, '{}'::jsonb, now(), now())`,
        [userId, enrollmentId],
      ),
    ).rejects.toThrow()
  })

  it('new attempt defaults to in_progress status and mock type with null started_at and deadline', async () => {
    const { userId, enrollmentId } = await seedUserAndEnrollment(harness)
    const conn = harness.getEm().getConnection()

    const result = await conn.execute<{
      status: string
      type: string
      started_at: string | null
      deadline: string | null
    }>(
      `INSERT INTO mock_exams (id, user_id, user_certification_id, questions, domain_breakdown, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, '[]'::jsonb, '{}'::jsonb, now(), now())
       RETURNING status, type, started_at, deadline`,
      [userId, enrollmentId],
    )

    const row = (
      result as { status: string; type: string; started_at: string | null; deadline: string | null }[]
    )[0]!
    expect(row.status).toBe('in_progress')
    expect(row.type).toBe('mock')
    expect(row.started_at).toBeNull()
    expect(row.deadline).toBeNull()
  })

  it('status enum rejects invalid values', async () => {
    const { userId, enrollmentId } = await seedUserAndEnrollment(harness)
    const conn = harness.getEm().getConnection()

    await expect(
      conn.execute(
        `INSERT INTO mock_exams (id, user_id, user_certification_id, type, status, questions, domain_breakdown, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'mock', 'bogus_status', '[]'::jsonb, '{}'::jsonb, now(), now())`,
        [userId, enrollmentId],
      ),
    ).rejects.toThrow()
  })
})
