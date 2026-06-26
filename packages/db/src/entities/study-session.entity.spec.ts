import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDbHarness, type DbHarness } from '../test-helpers/db-harness'
import { SessionItem } from './session-item.entity'
import { StudySession } from './study-session.entity'
import { User } from './user.entity'
import { UserCertification } from './user-certification.entity'

describe('StudySession and SessionItem entities', () => {
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

  it('persists and round-trips a StudySession with all fields', async () => {
    const em = harness.getEm()
    const conn = em.getConnection()

    const userResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), 'test@example.com', 'hash', 'user', now(), now())
       RETURNING id`,
    )
    const userId = userResult[0]!.id

    const certResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Test Cert', 'AWS', 'TEST-01', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
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

    const startedAt = new Date()
    const session = em.create(StudySession, {
      userCertification: em.getReference(UserCertification, enrollmentId),
      user: em.getReference(User, userId),
      kind: 'study',
      status: 'active',
      durationMinutes: 30,
      contentMix: 'balanced',
      difficulty: 'intermediate',
      focusArea: { mode: 'auto' },
      learningStyle: 'weak-area-focus',
      lastItemIndex: 0,
      startedAt,
      endedAt: null,
    })
    em.persist(session)
    await em.flush()

    const em2 = harness.getEm()
    const loaded = await em2.findOne(StudySession, { id: session.id })
    expect(loaded).not.toBeNull()
    expect(loaded!.kind).toBe('study')
    expect(loaded!.status).toBe('active')
    expect(loaded!.durationMinutes).toBe(30)
    expect(loaded!.contentMix).toBe('balanced')
    expect(loaded!.difficulty).toBe('intermediate')
    expect(loaded!.focusArea).toEqual({ mode: 'auto' })
    expect(loaded!.learningStyle).toBe('weak-area-focus')
    expect(loaded!.lastItemIndex).toBe(0)
    expect(loaded!.endedAt).toBeNull()
  })

  it('persists and round-trips a SessionItem with provenance snapshot', async () => {
    const em = harness.getEm()
    const conn = em.getConnection()

    const userResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), 'item@example.com', 'hash', 'user', now(), now())
       RETURNING id`,
    )
    const userId = userResult[0]!.id

    const certResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Item Cert', 'AWS', 'ITEM-01', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
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

    const sessionResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'study', 'active', 30, 'balanced', 'intermediate', '{"mode":"auto"}'::jsonb, 'weak-area-focus', 0, now(), now(), now())
       RETURNING id`,
      [enrollmentId, userId],
    )
    const sessionId = sessionResult[0]!.id

    const item = em.create(SessionItem, {
      session: em.getReference(StudySession, sessionId),
      index: 0,
      type: 'reading',
      content: '## Overview\n\nSome content\n\n**TL;DR:** Key point 1',
      completed: false,
      sourceChunkIds: ['chunk-1', 'chunk-2'],
      supportingSpans: ['span 1', 'span 2'],
    })
    em.persist(item)
    await em.flush()

    const em2 = harness.getEm()
    const loaded = await em2.findOne(SessionItem, { id: item.id })
    expect(loaded).not.toBeNull()
    expect(loaded!.index).toBe(0)
    expect(loaded!.type).toBe('reading')
    expect(loaded!.completed).toBe(false)
    expect(loaded!.sourceChunkIds).toEqual(['chunk-1', 'chunk-2'])
    expect(loaded!.supportingSpans).toEqual(['span 1', 'span 2'])
  })

  it('enforces the partial unique constraint: only one active session per enrollment', async () => {
    const conn = harness.getEm().getConnection()

    const userResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), 'unique@example.com', 'hash', 'user', now(), now())
       RETURNING id`,
    )
    const userId = userResult[0]!.id

    const certResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Unique Cert', 'AWS', 'UNIQ-01', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
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

    await conn.execute(
      `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'study', 'active', 30, 'balanced', 'intermediate', '{"mode":"auto"}'::jsonb, 'weak-area-focus', 0, now(), now(), now())`,
      [enrollmentId, userId],
    )

    await expect(
      conn.execute(
        `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'study', 'active', 30, 'balanced', 'intermediate', '{"mode":"auto"}'::jsonb, 'weak-area-focus', 0, now(), now(), now())`,
        [enrollmentId, userId],
      ),
    ).rejects.toThrow()
  })

  it('allows a second active session for a different enrollment', async () => {
    const conn = harness.getEm().getConnection()

    const userResult = await conn.execute<{ id: string }[]>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), 'two@example.com', 'hash', 'user', now(), now())
       RETURNING id`,
    )
    const userId = userResult[0]!.id

    const certResult1 = await conn.execute<{ id: string }[]>(
      `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Cert A', 'AWS', 'CERTA', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
       RETURNING id`,
    )
    const certResult2 = await conn.execute<{ id: string }[]>(
      `INSERT INTO certifications (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Cert B', 'AWS', 'CERTB', '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
       RETURNING id`,
    )

    const enroll1 = await conn.execute<{ id: string }[]>(
      `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now()) RETURNING id`,
      [userId, certResult1[0]!.id],
    )
    const enroll2 = await conn.execute<{ id: string }[]>(
      `INSERT INTO user_certifications (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now()) RETURNING id`,
      [userId, certResult2[0]!.id],
    )

    await conn.execute(
      `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'study', 'active', 30, 'balanced', 'intermediate', '{"mode":"auto"}'::jsonb, 'weak-area-focus', 0, now(), now(), now())`,
      [enroll1[0]!.id, userId],
    )

    await expect(
      conn.execute(
        `INSERT INTO study_sessions (id, user_certification_id, user_id, kind, status, duration_minutes, content_mix, difficulty, focus_area, learning_style, last_item_index, started_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, ?, 'study', 'active', 30, 'balanced', 'intermediate', '{"mode":"auto"}'::jsonb, 'weak-area-focus', 0, now(), now(), now())`,
        [enroll2[0]!.id, userId],
      ),
    ).resolves.toBeDefined()
  })
})
