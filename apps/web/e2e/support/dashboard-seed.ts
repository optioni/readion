import type { APIRequestContext } from '@playwright/test'
import { captureVerificationToken } from './mailpit-helpers'

// Seeds an authenticated user with active enrollments through the SAME running API
// (127.0.0.1:3001) that the Nuxt dev server talks to — never the in-process Testcontainers
// harness, which boots its own API on a random port the browser can't reach.
//
// The dashboard SPEC scenarios want a richer signal than enrollments alone:
//   - one calibrated-low cert (lowest readiness → gradient hero)
//   - one calibrated-high cert (standard surface card, sorted after the hero)
//   - one not-yet-calibrated cert ("not yet calibrated" copy, sorted last)
//   - graded answers, recent completed sessions (domain + accuracy), and due reviews
//
// Genuinely *calibrating* an enrollment requires submitting graded answers, which runs
// through LLM-backed quiz generation/verification — not reproducible purely over the public
// API in this environment. The reliable public-API seeding (register → verify → enroll N
// certs, plus the hero rule computed from the real enrollment rows) is done here; the
// calibration / graded-answer / due-review enrichment is a documented TODO for the GREEN
// group (web-dashboard task group 7), which runs against a fully provisioned API.

const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' }

type RegisterResponse = { data: { accessToken: string } }
type CertificationRow = { id: string; name: string; provider: string }
type CertificationsResponse = { data: CertificationRow[] }
type EnrollResponse = { data: { id: string } }
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

  const authHeaders = { Authorization: `Bearer ${accessToken}` }

  const certsRes = await api.get('/api/v1/certifications', { headers: authHeaders })
  if (certsRes.status() !== 200) {
    throw new Error(`Seed failed to list certifications: HTTP ${certsRes.status()}`)
  }
  const { data: certifications } = (await certsRes.json()) as CertificationsResponse

  // Precondition: the seeded environment must have a certification catalog (owned by admin
  // setup). We enroll into the first three and keep one aside for the add-certification flow.
  if (certifications.length < 3) {
    throw new Error(
      `Seed precondition: need >=3 certifications in the catalog, found ${certifications.length}. ` +
        'Provision the certification catalog (admin setup) before running the dashboard e2e.',
    )
  }

  const certsToEnroll = certifications.slice(0, certifications.length - 1).slice(0, 3)
  const addableCertification = certifications[certifications.length - 1]
  if (!addableCertification) {
    throw new Error('Seed precondition: no certification left for the add-certification flow')
  }

  for (const certification of certsToEnroll) {
    const enrollRes = await api.post('/api/v1/user-certifications', {
      headers: { ...authHeaders, ...CONTENT_TYPE_JSON },
      data: { certificationId: certification.id },
    })
    if (enrollRes.status() !== 201) {
      throw new Error(`Seed failed to enroll into ${certification.id}: HTTP ${enrollRes.status()}`)
    }
    ;(await enrollRes.json()) as EnrollResponse

    // TODO(web-dashboard group 7 — GREEN): enrich this enrollment with graded answers,
    // completed sessions (domain + accuracy via session summaries), and due reviews so the
    // calibrated-low / calibrated-high / due-review SPEC scenarios are exercised against real
    // data. Requires the LLM-backed generation/verification path, unavailable in the RED env.
  }

  // Read the enrollment rows back to compute the hero from the real readinessScore/enrolledAt.
  const listRes = await api.get('/api/v1/user-certifications?status=active', {
    headers: authHeaders,
  })
  if (listRes.status() !== 200) {
    throw new Error(`Seed failed to list enrollments: HTTP ${listRes.status()}`)
  }
  const { data: enrollmentRows } = (await listRes.json()) as EnrollmentsResponse

  const certById = new Map(certifications.map((certification) => [certification.id, certification]))
  const enrollments: SeededEnrollment[] = enrollmentRows.map((row) => {
    const certification = certById.get(row.certificationId)
    return {
      enrollmentId: row.id,
      certificationId: row.certificationId,
      name: certification?.name ?? row.certificationId,
      provider: certification?.provider ?? '',
      readinessScore: row.readinessScore,
    }
  })

  const firstEnrollment = enrollments[0]
  if (!firstEnrollment) {
    throw new Error('Seed produced no enrollments')
  }

  return {
    email,
    password,
    accessToken,
    enrollments,
    heroEnrollment: pickHero(enrollments),
    addableCertification,
  }
}
