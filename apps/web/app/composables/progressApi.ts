import type {
  ReviewItemResponse,
  ReviewQueueMeta,
  StartReviewResponse,
  SuppressDomainRequest,
  SuppressDomainResponse,
} from '@readion/shared'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import { enrollmentMockExamControllerList } from '~~/src/api/enrollment-mock-exam/enrollment-mock-exam'
import {
  enrollmentReviewControllerQueue,
  enrollmentReviewControllerStart,
  enrollmentReviewControllerSuppressDomain,
} from '~~/src/api/enrollment-review/enrollment-review'
import type {
  CertificationDetailResponseDto,
  EnrollmentDetailResponseDto,
  EnrollmentListResponseDto,
  MockExamListResponseDto,
  ReadinessResponseDto,
  SessionListResponseDto,
  SessionsControllerListParams,
  WeakAreaListResponseDto,
} from '~~/src/api/model'
import { readinessControllerRead } from '~~/src/api/readiness/readiness'
import { reviewItemsControllerMaster } from '~~/src/api/review-items/review-items'
import { sessionsControllerList } from '~~/src/api/sessions/sessions'
import {
  userCertificationsControllerDetail,
  userCertificationsControllerList,
  userCertificationsControllerListWeakAreas,
} from '~~/src/api/user-certifications/user-certifications'

export {
  drillSession,
  fetchSessionSummary,
  generateQuizExplanation,
  reportQuizQuestion,
  submitQuizAnswer,
} from '~/composables/sessionViewApi'

const jsonHeaders = { 'Content-Type': 'application/json' }

const jsonBody = (body: unknown): RequestInit => ({
  headers: jsonHeaders,
  body: JSON.stringify(body),
})

// Several review endpoints have no response schema in the OpenAPI doc, so the generated
// client types their body as `void`; narrow the success envelope to read the payload.
const unwrapEnvelope = <T>(response: { data: unknown }): T => (response.data as { data: T }).data

export async function fetchReadiness(enrollmentId: string): Promise<ReadinessResponseDto> {
  const response = await readinessControllerRead(enrollmentId)
  return response.data.data
}

export async function fetchWeakAreas(enrollmentId: string): Promise<WeakAreaListResponseDto> {
  const response = await userCertificationsControllerListWeakAreas(enrollmentId)
  return response.data
}

export async function fetchCertificationDetail(
  certificationId: string,
): Promise<CertificationDetailResponseDto> {
  const response = await certificationsControllerDetail(certificationId)
  return response.data
}

export async function fetchEnrollments(): Promise<EnrollmentListResponseDto> {
  const response = await userCertificationsControllerList()
  return response.data
}

export async function fetchEnrollmentDetail(
  enrollmentId: string,
): Promise<EnrollmentDetailResponseDto> {
  const response = await userCertificationsControllerDetail(enrollmentId)
  return response.data
}

export async function fetchSessions(
  params?: SessionsControllerListParams,
): Promise<SessionListResponseDto> {
  const response = await sessionsControllerList(params)
  return response.data
}

export async function fetchEnrollmentMockExams(
  enrollmentId: string,
): Promise<MockExamListResponseDto> {
  const response = await enrollmentMockExamControllerList(enrollmentId)
  if (response.status !== 200) {
    return { data: [], meta: { total: 0, page: 1, limit: 20 } }
  }
  return response.data as MockExamListResponseDto
}

export async function fetchReviewQueue(
  enrollmentId: string,
): Promise<{ items: ReviewItemResponse[]; meta: ReviewQueueMeta }> {
  const response = await enrollmentReviewControllerQueue(enrollmentId)
  // The queue endpoint returns { items, meta } directly without the standard data-envelope.
  return response.data as unknown as { items: ReviewItemResponse[]; meta: ReviewQueueMeta }
}

export async function startReview(enrollmentId: string): Promise<StartReviewResponse> {
  const response = await enrollmentReviewControllerStart(enrollmentId)
  return unwrapEnvelope<StartReviewResponse>(response)
}

export async function suppressDomain(
  enrollmentId: string,
  body: SuppressDomainRequest,
): Promise<SuppressDomainResponse> {
  const response = await enrollmentReviewControllerSuppressDomain(enrollmentId, jsonBody(body))
  return unwrapEnvelope<SuppressDomainResponse>(response)
}

export async function masterReviewItem(reviewItemId: string): Promise<void> {
  await reviewItemsControllerMaster(reviewItemId)
}
