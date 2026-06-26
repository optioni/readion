import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDbHarness, type DbHarness } from '../test-helpers/db-harness'
import { ReviewItem } from './review-item.entity'
import { UserCertification } from './user-certification.entity'

async function seedEnrollmentAndChunk(
  harness: DbHarness,
): Promise<{ enrollmentId: string; chunkId: string }> {
  const conn = harness.getEm().getConnection()

  const userResult = await conn.execute<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES (gen_random_uuid(), 'review-${Math.random()}@example.com', 'hash', 'user', now(), now())
     RETURNING id`,
  )
  const userId = userResult[0]!.id

  const certResult = await conn.execute<{ id: string }[]>(
    `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
     VALUES (gen_random_uuid(), 'Review Cert', 'AWS', 'REV-${Math.floor(Math.random() * 1e6)}', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
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

  const sourceResult = await conn.execute<{ id: string }[]>(
    `INSERT INTO content_sources (id, certification_id, type, url, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, 'web', 'https://x.example/${Math.random()}', 60, now(), now())
     RETURNING id`,
    [certId],
  )
  const chunkResult = await conn.execute<{ id: string }[]>(
    `INSERT INTO content_chunks (id, content_source_id, certification_id, text, content_hash, domain_tags, primary_domain, metadata, state, created_at, updated_at)
     VALUES (gen_random_uuid(), ?, ?, 'text', 'hash-${Math.random()}', '[]'::jsonb, 'Security', '{}'::jsonb, 'active', now(), now())
     RETURNING id`,
    [sourceResult[0]!.id, certId],
  )

  return { enrollmentId, chunkId: chunkResult[0]!.id }
}

describe('ReviewItem entity', () => {
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

  it('persists and round-trips a ReviewItem anchored to a chunk and enrollment', async () => {
    const { enrollmentId, chunkId } = await seedEnrollmentAndChunk(harness)
    const em = harness.getEm()

    const dueAt = new Date()
    const item = em.create(ReviewItem, {
      userCertification: em.getReference(UserCertification, enrollmentId),
      anchorChunkId: chunkId,
      box: 2,
      state: 'active',
      dueAt,
      lastReviewedAt: null,
    })
    em.persist(item)
    await em.flush()

    const loaded = await harness.getEm().findOne(ReviewItem, { id: item.id })
    expect(loaded).not.toBeNull()
    expect(loaded!.anchorChunkId).toBe(chunkId)
    expect(loaded!.box).toBe(2)
    expect(loaded!.state).toBe('active')
    expect(loaded!.lastReviewedAt).toBeNull()
  })

  it('enforces one review item per concept per enrollment', async () => {
    const { enrollmentId, chunkId } = await seedEnrollmentAndChunk(harness)
    const conn = harness.getEm().getConnection()

    await conn.execute(
      `INSERT INTO review_items (id, user_certification_id, anchor_chunk_id, box, state, due_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 1, 'active', now(), now(), now())`,
      [enrollmentId, chunkId],
    )

    await expect(
      conn.execute(
        `INSERT INTO review_items (id, user_certification_id, anchor_chunk_id, box, state, due_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 1, 'active', now(), now(), now())`,
        [enrollmentId, chunkId],
      ),
    ).rejects.toThrow()
  })

  it('rejects an invalid state value via the check constraint', async () => {
    const { enrollmentId, chunkId } = await seedEnrollmentAndChunk(harness)
    const conn = harness.getEm().getConnection()

    await expect(
      conn.execute(
        `INSERT INTO review_items (id, user_certification_id, anchor_chunk_id, box, state, due_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 1, 'bogus', now(), now(), now())`,
        [enrollmentId, chunkId],
      ),
    ).rejects.toThrow()
  })
})
