import type { APIRequestContext } from '@playwright/test'
import { Client } from 'pg'
import { captureVerificationToken } from './mailpit-helpers'

// Shared scaffolding for the e2e seeds (dashboard + cert-detail). Both seed users through the SAME
// running API (127.0.0.1:3001) the Nuxt dev server talks to — never the in-process Testcontainers
// harness, whose API lives on a random port the browser can't reach — and write the FK-chained
// rows the public API cannot produce locally directly into the same Postgres database.

export const seedDatabaseUrl =
  process.env.READION_E2E_DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion'

export const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' }

export type RegisterResponse = { data: { accessToken: string } }
export type CertificationRow = { id: string; name: string; provider: string }
export type CertificationsResponse = { data: CertificationRow[] }

export function newSeedClient(): Client {
  return new Client({ connectionString: seedDatabaseUrl })
}

// Promotes draft certifications to `live` until the catalog has at least `minLive` of them. The
// catalog is normally admin-provisioned; in a freshly migrated local database it can be empty of
// live certs, so the seeds make themselves self-sufficient and idempotent.
export async function ensureLiveCatalog(client: Client, minLive: number): Promise<void> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::int AS count FROM certifications WHERE state = 'live'`,
  )
  const liveCount = Number(rows[0]?.count ?? 0)
  const missing = minLive - liveCount
  if (missing <= 0) {
    return
  }
  await client.query(
    `UPDATE certifications SET state = 'live', updated_at = now()
     WHERE id IN (
       SELECT id FROM certifications WHERE state = 'draft' ORDER BY name ASC LIMIT $1
     )`,
    [missing],
  )
}

// Registers and email-verifies a fresh user via the public API so the browser can sign in via the
// /login UI as that same user. `prefix` keeps the two suites' generated addresses distinguishable.
export async function registerVerifiedUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
  prefix: string,
): Promise<{ email: string; password: string; accessToken: string }> {
  const email = `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
  const password = 'correcthorse'

  const registerRes = await api.post('/api/v1/auth/register', {
    headers: CONTENT_TYPE_JSON,
    data: { email, password },
  })
  if (registerRes.status() !== 201) {
    throw new Error(`Seed failed to register user: HTTP ${registerRes.status()}`)
  }
  const {
    data: { accessToken },
  } = (await registerRes.json()) as RegisterResponse

  const verificationToken = await captureVerificationToken(mailpit, email)
  const verifyRes = await api.post('/api/v1/auth/verify-email', {
    headers: CONTENT_TYPE_JSON,
    data: { token: verificationToken },
  })
  if (verifyRes.status() !== 200 && verifyRes.status() !== 201) {
    throw new Error(`Seed failed to verify email: HTTP ${verifyRes.status()}`)
  }

  return { email, password, accessToken }
}

export async function createContentSource(
  client: Client,
  certificationId: string,
  url: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO content_sources
       (id, certification_id, type, url, enabled, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'web', $2, true, 1440, now(), now())
     RETURNING id`,
    [certificationId, url],
  )
  const id = result.rows[0]?.id
  if (id === undefined) {
    throw new Error('Seed failed to create a content source')
  }
  return id
}

export async function createContentChunk(
  client: Client,
  params: {
    contentSourceId: string
    certificationId: string
    primaryDomain: string
    hashSeed: string
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO content_chunks
       (id, content_source_id, certification_id, text, content_hash,
        domain_tags, primary_domain, metadata, state, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4,
        $5::jsonb, $6, '{}'::jsonb, 'active', now(), now())
     RETURNING id`,
    [
      params.contentSourceId,
      params.certificationId,
      `Reviewable content for ${params.primaryDomain} (e2e).`,
      params.hashSeed.padEnd(64, '0').slice(0, 64),
      JSON.stringify([{ domain: params.primaryDomain, confidence: 0.95 }]),
      params.primaryDomain,
    ],
  )
  const id = result.rows[0]?.id
  if (id === undefined) {
    throw new Error(`Seed failed to create a content chunk for ${params.primaryDomain}`)
  }
  return id
}

// Writes the content_source → content_chunk → review_item FK chain a due review needs, so the
// running API's review-queue endpoint reports dueCount > 0 for this enrollment.
export async function seedDueReview(
  client: Client,
  enrollmentId: string,
  certificationId: string,
): Promise<void> {
  const contentSourceId = await createContentSource(
    client,
    certificationId,
    `https://example.com/e2e-review-${enrollmentId}`,
  )
  const anchorChunkId = await createContentChunk(client, {
    contentSourceId,
    certificationId,
    primaryDomain: 'Security',
    hashSeed: `e2e-review-${enrollmentId}`,
  })

  await client.query(
    `INSERT INTO review_items
       (id, user_certification_id, anchor_chunk_id, box, state, due_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 1, 'active', now() - interval '1 day', now(), now())`,
    [enrollmentId, anchorChunkId],
  )
}
