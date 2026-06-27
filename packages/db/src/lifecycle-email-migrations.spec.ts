import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbHarness, type DbHarness } from './test-helpers/db-harness'

async function columnNames(harness: DbHarness, table: string, columns: string[]) {
  const inList = columns.map((c) => `'${c}'`).join(', ')
  const rows = await harness
    .getEm()
    .getConnection()
    .execute<{ column_name: string }[]>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = '${table}'
       AND column_name IN (${inList})`,
    )
  return rows.map((r) => r.column_name).sort()
}

describe('lifecycle-email migrations', () => {
  let harness: DbHarness

  beforeAll(async () => {
    harness = await createDbHarness()
  }, 120_000)

  afterAll(async () => {
    await harness?.teardown()
  })

  it('adds the digest lifecycle columns to users', async () => {
    const names = await columnNames(harness, 'users', [
      'digest_opt_out',
      'unsubscribe_token',
      'last_digest_sent_at',
    ])
    expect(names).toEqual(['digest_opt_out', 'last_digest_sent_at', 'unsubscribe_token'])
  })

  it('defaults users lifecycle columns on a freshly inserted row', async () => {
    const conn = harness.getEm().getConnection()
    const [row] = await conn.execute<
      {
        digest_opt_out: boolean
        unsubscribe_token: string | null
        last_digest_sent_at: Date | null
      }[]
    >(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'user', now(), now())
       RETURNING digest_opt_out, unsubscribe_token, last_digest_sent_at`,
      [
        `digest-${Math.random()}@example.com`,
        '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
      ],
    )
    expect(row.digest_opt_out).toBe(false)
    expect(row.unsubscribe_token).toBeNull()
    expect(row.last_digest_sent_at).toBeNull()
  })

  it('adds the exam-outcome columns to user_certifications', async () => {
    const names = await columnNames(harness, 'user_certifications', [
      'last_digest_readiness',
      'exam_outcome_nudge_sent_at',
      'exam_outcome_nudge_count',
      'exam_outcome_response',
      'exam_outcome_responded_at',
    ])
    expect(names).toEqual([
      'exam_outcome_nudge_count',
      'exam_outcome_nudge_sent_at',
      'exam_outcome_responded_at',
      'exam_outcome_response',
      'last_digest_readiness',
    ])
  })

  it('defaults exam-outcome columns on a freshly inserted enrollment', async () => {
    const conn = harness.getEm().getConnection()
    const [user] = await conn.execute<{ id: string }[]>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'user', now(), now())
       RETURNING id`,
      [
        `enroll-${Math.random()}@example.com`,
        '$2b$04$abcdefghijklmnopqrstuuF4Tw8dDGhl6G7y1aCyYx2eZP6Zxq6i2',
      ],
    )
    const [cert] = await conn.execute<{ id: string }[]>(
      `INSERT INTO certifications
        (id, name, provider, code, domains, question_count, passing_score, time_limit_minutes, provenance, state, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Cert', 'AWS', ?, '[]'::jsonb, 65, 700, 90, '"verified"'::jsonb, 'live', now(), now())
       RETURNING id`,
      [`CODE-${Math.random()}`],
    )
    const [row] = await conn.execute<
      {
        last_digest_readiness: number | null
        exam_outcome_nudge_sent_at: Date | null
        exam_outcome_nudge_count: number
        exam_outcome_response: string | null
        exam_outcome_responded_at: Date | null
      }[]
    >(
      `INSERT INTO user_certifications
        (id, user_id, certification_id, status, enrolled_at, created_at, updated_at)
       VALUES (gen_random_uuid(), ?, ?, 'active', now(), now(), now())
       RETURNING
         last_digest_readiness,
         exam_outcome_nudge_sent_at,
         exam_outcome_nudge_count,
         exam_outcome_response,
         exam_outcome_responded_at`,
      [user.id, cert.id],
    )
    expect(row.last_digest_readiness).toBeNull()
    expect(row.exam_outcome_nudge_sent_at).toBeNull()
    expect(row.exam_outcome_nudge_count).toBe(0)
    expect(row.exam_outcome_response).toBeNull()
    expect(row.exam_outcome_responded_at).toBeNull()
  })

  it('round-trips the lifecycle-email migrations down and back up', async () => {
    await harness.orm.migrator.down({ to: '20260706000000' })

    const afterDown = await columnNames(harness, 'users', ['digest_opt_out'])
    expect(afterDown).toHaveLength(0)

    await harness.orm.migrator.up()

    const afterUp = await columnNames(harness, 'users', ['digest_opt_out'])
    expect(afterUp).toEqual(['digest_opt_out'])
  })
})
