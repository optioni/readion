import type { SessionDefaults } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import { onboardingQueryKeys } from '~/composables/onboardingQueryKeys'
import { onboardingMockExamRunPath } from '~/composables/onboardingRoutes'
import {
  diagnosticControllerCreate,
  diagnosticControllerDismissOffer,
} from '~~/src/api/diagnostic/diagnostic'
import { userCertificationsControllerEnroll } from '~~/src/api/user-certifications/user-certifications'
import { usersControllerUpdateMe } from '~~/src/api/users/users'

const jsonHeaders = { 'Content-Type': 'application/json' }

const DASHBOARD_ROUTE = '/'

// The diagnostic-create endpoint has no response schema in the OpenAPI doc, so the
// generated client types its body as `void`; narrow the envelope to read the attempt id.
const readEnvelopeId = (response: { data: unknown }): string =>
  (response.data as { data: { id: string } }).data.id

export type EnrollOutcome = { ok: true; enrollmentId: string } | { ok: false; error: unknown }

export function useOnboardingActions() {
  const queryClient = useQueryClient()

  async function saveDefaultsAndEnroll(input: {
    certificationId: string
    sessionDefaults: SessionDefaults
  }): Promise<EnrollOutcome> {
    await usersControllerUpdateMe({
      headers: jsonHeaders,
      body: JSON.stringify({ sessionDefaults: input.sessionDefaults }),
    })

    let enrollmentId: string
    try {
      const response = await userCertificationsControllerEnroll({
        headers: jsonHeaders,
        body: JSON.stringify({
          certificationId: input.certificationId,
          sessionDefaults: input.sessionDefaults,
        }),
      })
      enrollmentId = response.data.data.id
    } catch (error) {
      return { ok: false, error }
    }

    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.enrollments() })
    await queryClient.invalidateQueries({ queryKey: onboardingQueryKeys.enrollments() })

    return { ok: true, enrollmentId }
  }

  async function takeDiagnostic(enrollmentId: string) {
    const response = await diagnosticControllerCreate(enrollmentId)
    await navigateTo(onboardingMockExamRunPath(readEnvelopeId(response)))
  }

  async function skipDiagnostic(enrollmentId: string) {
    await diagnosticControllerDismissOffer(enrollmentId)
    await navigateTo(DASHBOARD_ROUTE)
  }

  return { saveDefaultsAndEnroll, takeDiagnostic, skipDiagnostic }
}
