import type { APIRequestContext } from '@playwright/test'
import { Client } from 'pg'
import { captureVerificationToken } from './mailpit-helpers'

// Seeds an authenticated user with active enrollments through the SAME running API
// (127.0.0.1:3001) that the Nuxt dev server talks to — never the in-process Testcontainers
// harness, which boots its own API on a random port the browser can't reach.
//
// Registration, email verification, and enrollment go through the public API. Two pieces of
// dashboard state cannot be produced over the public API in a local environment because they
// require the LLM-backed quiz/answer-verification path:
//   - a non-null readinessScore (calibration), and
//   - graded answers / completed-session summaries.
// Those remain null/empty here, which is itself a valid dashboard state the acceptance test
// exercises ("not yet calibrated", empty panels, most-recently-enrolled hero fallback).
//
// Due reviews, however, only depend on ReviewItem rows (no LLM), so we seed one directly into
// the same Postgres database the running API reads from. That makes the SPEC-mandated
// conditional "5-minute review" quick-start appear on a real card with a real dueCount.

const databaseUrl =
  process.env.READION_E2E_DATABASE_URL ?? 'postgresql://readion:readion@localhost:5432/readion'

// Minimum live certifications the acceptance flow needs: three to enroll into plus one kept
// aside for the "+ Add certification" flow.
const MIN_LIVE_CERTIFICATIONS = 4

const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' }

type RegisterResponse = { data: { accessToken: string } }
type CertificationRow = { id: string; name: string; provider: string }
type CertificationsResponse = { data: CertificationRow[] }
type EnrollmentRow = {
  id: string
  certificationId: string
  enrolledAt: string
  readinessScore: number | null
}
type EnrollmentsResponse = { data: EnrollmentRow[] }

export type SeededEnrollment = {
  enrollmentId: string
  certificationId: string
  name: string
  provider: string
  readinessScore: number | null
  enrolledAt: string
}

export type SeededDashboardUser = {
  email: string
  password: string
  accessToken: string
  enrollments: SeededEnrollment[]
  // The enrollment the dashboard must promote to the gradient hero slot, derived from the
  // SPEC rule (lowest calibrated readiness; most-recently-enrolled when none are calibrated)
  // applied to the actually-seeded enrollment rows.
  heroEnrollment: SeededEnrollment
  // The enrollment seeded with a due review, so the conditional "5-minute review" quick-start
  // renders against a real dueCount.
  dueReviewEnrollment: SeededEnrollment
  // A certification the user is NOT enrolled in, kept aside for the "+ Add certification" flow.
  addableCertification: CertificationRow
}

function pickHero(enrollments: SeededEnrollment[]): SeededEnrollment {
  const calibrated = enrollments.filter(
    (enrollment): enrollment is SeededEnrollment & { readinessScore: number } =>
      enrollment.readinessScore !== null,
  )
  if (calibrated.length > 0) {
    return calibrated.reduce((lowest, candidate) =>
      candidate.readinessScore < lowest.readinessScore ? candidate : lowest,
    )
  }
  return enrollments.reduce((latest, candidate) =>
    Date.parse(candidate.enrolledAt ?? '') > Date.parse(latest.enrolledAt ?? '')
      ? candidate
      : latest,
  )
}

// Promotes draft certifications to `live` until the catalog has enough for the acceptance flow.
// The catalog is normally admin-provisioned; in a freshly migrated local database it can be
// empty of live certs, so the seed makes itself self-sufficient and idempotent.
async function ensureLiveCatalog(client: Client): Promise<void> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::int AS count FROM certifications WHERE state = 'live'`,
  )
  const liveCount = Number(rows[0]?.count ?? 0)
  const missing = MIN_LIVE_CERTIFICATIONS - liveCount
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

// Writes the FK chain (content_source → content_chunk → review_item) a due review needs, so the
// running API's review-queue endpoint reports dueCount > 0 for this enrollment.
async function seedDueReview(client: Client, enrollment: SeededEnrollment): Promise<void> {
  const sourceResult = await client.query<{ id: string }>(
    `INSERT INTO content_sources
       (id, certification_id, type, url, enabled, recheck_interval_minutes, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'web', $2, true, 1440, now(), now())
     RETURNING id`,
    [enrollment.certificationId, `https://example.com/e2e-${enrollment.enrollmentId}`],
  )
  const contentSourceId = sourceResult.rows[0]?.id
  if (contentSourceId === undefined) {
    throw new Error('Seed failed to create a content source for the due review')
  }

  const chunkResult = await client.query<{ id: string }>(
    `INSERT INTO content_chunks
       (id, content_source_id, certification_id, text, content_hash,
        domain_tags, primary_domain, metadata, state, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4,
        $5::jsonb, $6, '{}'::jsonb, 'active', now(), now())
     RETURNING id`,
    [
      contentSourceId,
      enrollment.certificationId,
      'Reviewable content for the dashboard e2e.',
      `e2e-${enrollment.enrollmentId}`.padEnd(64, '0').slice(0, 64),
      JSON.stringify([{ domain: 'Security', confidence: 0.95 }]),
      'Security',
    ],
  )
  const anchorChunkId = chunkResult.rows[0]?.id
  if (anchorChunkId === undefined) {
    throw new Error('Seed failed to create a content chunk for the due review')
  }

  await client.query(
    `INSERT INTO review_items
       (id, user_certification_id, anchor_chunk_id, box, state, due_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 1, 'active', now() - interval '1 day', now(), now())`,
    [enrollment.enrollmentId, anchorChunkId],
  )
}

async function registerVerifiedUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<{ email: string; password: string; accessToken: string }> {
  const email = `dashboard.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
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

  // Verify the email so the browser can sign in via the /login UI as the same seeded user.
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

export async function seedDashboardUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<SeededDashboardUser> {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await ensureLiveCatalog(client)

    const { email, password, accessToken } = await registerVerifiedUser(api, mailpit)
    const authHeaders = { Authorization: `Bearer ${accessToken}` }

    const certsRes = await api.get('/api/v1/certifications', { headers: authHeaders })
    if (certsRes.status() !== 200) {
      throw new Error(`Seed failed to list certifications: HTTP ${certsRes.status()}`)
    }
    const { data: certifications } = (await certsRes.json()) as CertificationsResponse

    if (certifications.length < MIN_LIVE_CERTIFICATIONS) {
      throw new Error(
        `Seed precondition: need >=${MIN_LIVE_CERTIFICATIONS} live certifications, ` +
          `found ${certifications.length} after provisioning.`,
      )
    }

    const certsToEnroll = certifications.slice(0, 3)
    const addableCertification = certifications[certifications.length - 1]
    if (addableCertification === undefined) {
      throw new Error('Seed precondition: no certification left for the add-certification flow')
    }

    for (const certification of certsToEnroll) {
      const enrollRes = await api.post('/api/v1/user-certifications', {
        headers: { ...authHeaders, ...CONTENT_TYPE_JSON },
        data: { certificationId: certification.id },
      })
      if (enrollRes.status() !== 201) {
        throw new Error(
          `Seed failed to enroll into ${certification.id}: HTTP ${enrollRes.status()}`,
        )
      }
    }

    // Read the enrollment rows back to compute the hero from the real readinessScore/enrolledAt.
    const listRes = await api.get('/api/v1/user-certifications?status=active', {
      headers: authHeaders,
    })
    if (listRes.status() !== 200) {
      throw new Error(`Seed failed to list enrollments: HTTP ${listRes.status()}`)
    }
    const { data: enrollmentRows } = (await listRes.json()) as EnrollmentsResponse

    const certById = new Map(
      certifications.map((certification) => [certification.id, certification]),
    )
    const enrollments: SeededEnrollment[] = enrollmentRows.map((row) => {
      const certification = certById.get(row.certificationId)
      return {
        enrollmentId: row.id,
        certificationId: row.certificationId,
        name: certification?.name ?? row.certificationId,
        provider: certification?.provider ?? '',
        readinessScore: row.readinessScore,
        enrolledAt: row.enrolledAt,
      }
    })

    const heroEnrollment = pickHero(enrollments)
    await seedDueReview(client, heroEnrollment)

    return {
      email,
      password,
      accessToken,
      enrollments,
      heroEnrollment,
      dueReviewEnrollment: heroEnrollment,
      addableCertification,
    }
  } finally {
    await client.end()
  }
}
