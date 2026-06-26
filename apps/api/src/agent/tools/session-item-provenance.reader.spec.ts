import { createDbHarness, type DbHarness } from '@readion/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SessionItemProvenanceReader } from './session-item-provenance.reader'

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

async function seedSession(
  harness: DbHarness,
  enrollmentId: string,
  userId: string,
): Promise<string> {
  const conn = harness.getEm().getConnection()
  const rows = await conn.execute<{ id: string }[]>(
    `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'study', 'active', 30, 'balanced', 'intermediate', '{"mode":"auto"}'::jsonb, 'weak-area-focus', 0, now(), now(), now())
     RETURNING id`,
    [enrollmentId, userId],
  )
  return rows[0]!.id
}

async function seedItem(
  harness: DbHarness,
  sessionId: string,
  index: number,
  content: string,
): Promise<void> {
  const conn = harness.getEm().getConnection()
  await conn.execute(
    `INSERT INTO session_items (id, session_id, index, type, content, completed, source_chunk_ids, supporting_spans, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'reading', ?, false, ?::jsonb, ?::jsonb, now(), now())`,
    [
      sessionId,
      index,
      content,
      JSON.stringify(['chunk-a', 'chunk-b']),
      JSON.stringify(['span one', 'span two']),
    ],
  )
}

describe('SessionItemProvenanceReader', () => {
  let harness: DbHarness | undefined

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  afterEach(async () => {
    await harness?.resetState()
  })

  afterAll(async () => {
    await harness?.teardown()
  })

  function reader(): SessionItemProvenanceReader {
    if (!harness) throw new Error('DB harness was not initialized')
    return new SessionItemProvenanceReader(harness.getEm())
  }

  it("returns provenance for the user's own session item", async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'owner@example.com')
    const enrollmentId = await seedEnrollment(harness, userId, 'PROV-01')
    const sessionId = await seedSession(harness, enrollmentId, userId)
    await seedItem(harness, sessionId, 0, 'Reading block content.')

    const result = await reader().findOwnedProvenance(userId, sessionId, 0)

    expect(result).not.toBeNull()
    expect(result!.content).toBe('Reading block content.')
    expect(result!.sourceChunkIds).toEqual(['chunk-a', 'chunk-b'])
    expect(result!.supportingSpans).toEqual(['span one', 'span two'])
  })

  it('returns null when the session belongs to another user', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const ownerId = await seedUser(harness, 'real-owner@example.com')
    const otherId = await seedUser(harness, 'intruder@example.com')
    const enrollmentId = await seedEnrollment(harness, ownerId, 'PROV-02')
    const sessionId = await seedSession(harness, enrollmentId, ownerId)
    await seedItem(harness, sessionId, 0, 'Owner content.')

    const result = await reader().findOwnedProvenance(otherId, sessionId, 0)

    expect(result).toBeNull()
  })

  it('returns null when the item index does not exist', async () => {
    if (!harness) throw new Error('DB harness was not initialized')
    const userId = await seedUser(harness, 'missing@example.com')
    const enrollmentId = await seedEnrollment(harness, userId, 'PROV-03')
    const sessionId = await seedSession(harness, enrollmentId, userId)
    await seedItem(harness, sessionId, 0, 'Only item.')

    const result = await reader().findOwnedProvenance(userId, sessionId, 99)

    expect(result).toBeNull()
  })
})
