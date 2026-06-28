import type { APIRequestContext } from '@playwright/test'
import {
  type CertificationRow,
  type CertificationsResponse,
  CONTENT_TYPE_JSON,
  ensureLiveCatalog,
  newSeedClient,
  registerVerifiedUser,
  seedDueReview,
} from './seed-helpers'

// Seeds an authenticated user with active enrollments. Registration, email verification, and
// enrollment go through the public API; see seed-helpers.ts for the shared scaffolding.
//
// Two pieces of dashboard state cannot be produced over the public API in a local environment
// because they require the LLM-backed quiz/answer-verification path:
//   - a non-null readinessScore (calibration), and
//   - graded answers / completed-session summaries.
// Those remain null/empty here, which is itself a valid dashboard state the acceptance test
// exercises ("not yet calibrated", empty panels, most-recently-enrolled hero fallback).
//
// Due reviews, however, only depend on ReviewItem rows (no LLM), so we seed one directly into
// the same Postgres database the running API reads from. That makes the SPEC-mandated
// conditional "5-minute review" quick-start appear on a real card with a real dueCount.

// Minimum live certifications the acceptance flow needs: three to enroll into plus one kept
// aside for the "+ Add certification" flow.
const MIN_LIVE_CERTIFICATIONS = 4

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

export async function seedDashboardUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<SeededDashboardUser> {
  const client = newSeedClient()
  await client.connect()

  try {
    await ensureLiveCatalog(client, MIN_LIVE_CERTIFICATIONS)

    const { email, password, accessToken } = await registerVerifiedUser(api, mailpit, 'dashboard')
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
    await seedDueReview(client, heroEnrollment.enrollmentId, heroEnrollment.certificationId)

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
