import type { APIRequestContext } from '@playwright/test'
import { Client } from 'pg'
import {
  type CertificationRow,
  type CertificationsResponse,
  CONTENT_TYPE_JSON,
  ensureLiveCatalog,
  newSeedClient,
  registerVerifiedUser,
} from './seed-helpers'

// Seeds for the web-onboarding acceptance flow. Registration and email verification go through the
// public API (see seed-helpers.ts); the global certification catalog state and a user's role — which
// the onboarding routing gate keys off — are written directly into the same Postgres database the
// running API reads from, because no public endpoint can produce them locally.
//
// GLOBAL STATE CAVEAT: the certification catalog (`certifications.state`) is shared, process-wide
// state. The zero-catalog edge cases below set every live certification to `draft` and restore it
// afterward. That makes this spec safe to run on its own (as task 0.4 does: `test:e2e onboarding`,
// with the suite forced serial), but it cannot run in parallel with other suites that assume a live
// catalog (dashboard/cert-detail) — those would race on the same rows. Run onboarding in isolation.

const MIN_LIVE_CERTIFICATIONS = 1

type Credentials = { email: string; password: string; accessToken: string }
type EnrollResponse = { data: { id: string; certificationId: string } }

export type OnboardingNewUser = Credentials & {
  // The single live certification the cert-select step must surface (name + provider) and that the
  // happy path enrolls into.
  liveCert: CertificationRow
}

export type OnboardingEnrolledUser = Credentials & {
  enrollmentId: string
  certificationId: string
}

async function listCertifications(
  api: APIRequestContext,
  accessToken: string,
): Promise<CertificationRow[]> {
  const res = await api.get('/api/v1/certifications', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status() !== 200) {
    throw new Error(`Seed failed to list certifications: HTTP ${res.status()}`)
  }
  const { data } = (await res.json()) as CertificationsResponse
  return data
}

// A fresh verified user with no enrollments and a guaranteed live certification to select. This is
// the precondition for the onboarding happy path and the diagnostic-Take path.
export async function seedOnboardingNewUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<OnboardingNewUser> {
  const client = newSeedClient()
  await client.connect()
  try {
    await ensureLiveCatalog(client, MIN_LIVE_CERTIFICATIONS)
    const credentials = await registerVerifiedUser(api, mailpit, 'onboarding-new')
    const certifications = await listCertifications(api, credentials.accessToken)
    const liveCert = certifications[0]
    if (liveCert === undefined) {
      throw new Error('Seed precondition: no live certification available for onboarding')
    }
    return { ...credentials, liveCert }
  } finally {
    await client.end()
  }
}

// A verified user already enrolled in a live certification — the onboarding gate must redirect this
// user away from /onboarding to the dashboard.
export async function seedOnboardingEnrolledUser(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<OnboardingEnrolledUser> {
  const client = newSeedClient()
  await client.connect()
  try {
    await ensureLiveCatalog(client, MIN_LIVE_CERTIFICATIONS)
    const credentials = await registerVerifiedUser(api, mailpit, 'onboarding-enrolled')
    const certifications = await listCertifications(api, credentials.accessToken)
    const liveCert = certifications[0]
    if (liveCert === undefined) {
      throw new Error('Seed precondition: no live certification available to enroll into')
    }

    const enrollRes = await api.post('/api/v1/user-certifications', {
      headers: { Authorization: `Bearer ${credentials.accessToken}`, ...CONTENT_TYPE_JSON },
      data: { certificationId: liveCert.id },
    })
    if (enrollRes.status() !== 201) {
      throw new Error(`Seed failed to enroll into ${liveCert.id}: HTTP ${enrollRes.status()}`)
    }
    const { data: enrollment } = (await enrollRes.json()) as EnrollResponse
    return {
      ...credentials,
      enrollmentId: enrollment.id,
      certificationId: enrollment.certificationId,
    }
  } finally {
    await client.end()
  }
}

// Demotes every live certification to `draft` and returns the ids it changed, so the caller can
// restore exactly those after the zero-catalog edge case. Idempotent: a second call returns [].
export async function draftAllLiveCertifications(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    `UPDATE certifications SET state = 'draft', updated_at = now()
     WHERE state = 'live'
     RETURNING id`,
  )
  return rows.map((row) => row.id)
}

export async function restoreLiveCertifications(client: Client, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await client.query(
    `UPDATE certifications SET state = 'live', updated_at = now() WHERE id = ANY($1::uuid[])`,
    [ids],
  )
}

export async function promoteUserToAdmin(client: Client, email: string): Promise<void> {
  const result = await client.query(
    `UPDATE users SET role = 'admin', updated_at = now() WHERE email = $1`,
    [email],
  )
  if (result.rowCount !== 1) {
    throw new Error(`Seed failed to promote ${email} to admin (rowCount=${result.rowCount})`)
  }
}

export type ZeroCatalogUsers = {
  admin: Credentials
  nonAdmin: Credentials
  // Re-promotes exactly the certifications this seed drafted; callers MUST await it in teardown so
  // the shared catalog is left as it was found.
  restore: () => Promise<void>
}

// Registers one admin and one non-admin verified user, then drafts the entire live catalog in a
// single sweep (drafting is global state, so both zero-catalog gate cases share one draft/restore).
export async function seedZeroCatalogUsers(
  api: APIRequestContext,
  mailpit: APIRequestContext,
): Promise<ZeroCatalogUsers> {
  const client = newSeedClient()
  await client.connect()
  try {
    const admin = await registerVerifiedUser(api, mailpit, 'onboarding-admin-empty')
    await promoteUserToAdmin(client, admin.email)
    const nonAdmin = await registerVerifiedUser(api, mailpit, 'onboarding-user-empty')

    const draftedIds = await draftAllLiveCertifications(client)

    return {
      admin,
      nonAdmin,
      restore: async () => {
        const restoreClient = newSeedClient()
        await restoreClient.connect()
        try {
          await restoreLiveCertifications(restoreClient, draftedIds)
        } finally {
          await restoreClient.end()
        }
      },
    }
  } finally {
    await client.end()
  }
}
