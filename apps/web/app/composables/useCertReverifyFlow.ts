import type { CertExtractionFields } from '@readion/shared'
import { reverifyCertificationRequestSchema } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { readDataEnvelope, readExtractionStatusEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { isTerminalWithoutFields, nextRefetchInterval } from '~/composables/certExtractionPoll'
import { buildCertDiff, buildReverifyBody, type CertDiff } from '~/composables/certReverifyDiff'
import { discoverCertSources, enqueueCertExtraction } from '~/composables/certSetupKickoff'
import {
  certSetupControllerReadExtraction,
  certSetupControllerReverify,
} from '~~/src/api/cert-setup/cert-setup'
import { certificationsControllerDetail } from '~~/src/api/certifications/certifications'
import type { CertificationResponseDto } from '~~/src/api/model/certificationResponseDto'

const jsonHeaders = { 'Content-Type': 'application/json' }

export interface CertReverifyTarget {
  id: string
  name: string
  code: string
}

export interface CertReverifyFlow {
  activeCertId: ReturnType<typeof ref<string | null>>
  currentCert: ReturnType<typeof ref<CertificationResponseDto | null>>
  diff: ReturnType<typeof ref<CertDiff | null>>
  reverifyError: ReturnType<typeof ref<string | null>>
  submitting: ReturnType<typeof ref<boolean>>
  start: (item: CertReverifyTarget) => Promise<void>
  submit: () => Promise<void>
  reset: () => void
}

// Shared re-verification chain (fetch current values → discover → extract → poll → diff → submit)
// so both the Certifications-list modal and the dedicated /admin/certifications/:code/re-verify
// route drive the same logic against one diff table implementation.
export function useCertReverifyFlow(onSubmitted?: () => void | Promise<void>): CertReverifyFlow {
  const activeCertId = ref<string | null>(null)
  const currentCert = ref<CertificationResponseDto | null>(null)
  const confirmedSourceUrl = ref<string | null>(null)
  const jobId = ref<string | null>(null)
  const extractionFields = ref<CertExtractionFields | null>(null)
  const diff = ref<CertDiff | null>(null)
  const reverifyError = ref<string | null>(null)
  const submitting = ref(false)

  const extractionQuery = useQuery({
    queryKey: computed(() => adminQueryKeys.extraction(jobId.value ?? '')),
    queryFn: async () =>
      readExtractionStatusEnvelope(await certSetupControllerReadExtraction(jobId.value as string)),
    enabled: computed(() => Boolean(jobId.value)),
    refetchInterval: (query) =>
      nextRefetchInterval(query.state.data, query.state.fetchFailureCount),
  })

  watch(
    () => extractionQuery.data.value,
    (data) => {
      if (!data || !currentCert.value) return
      if (data.fields) {
        extractionFields.value = data.fields
        diff.value = buildCertDiff(currentCert.value, data.fields)
        return
      }
      if (isTerminalWithoutFields(data)) {
        reverifyError.value = 'Extraction did not produce any fields. Please try again.'
      }
    },
  )

  function reset(): void {
    activeCertId.value = null
    currentCert.value = null
    confirmedSourceUrl.value = null
    jobId.value = null
    extractionFields.value = null
    diff.value = null
  }

  async function start(item: CertReverifyTarget): Promise<void> {
    reset()
    reverifyError.value = null
    activeCertId.value = item.id

    try {
      const detail = await certificationsControllerDetail(item.id)
      currentCert.value = readDataEnvelope<CertificationResponseDto>(detail)

      const discovered = await discoverCertSources(item.name, item.code)
      confirmedSourceUrl.value = discovered.candidates[0]?.url ?? ''

      jobId.value = await enqueueCertExtraction(item.name, item.code, confirmedSourceUrl.value)
    } catch (error) {
      reverifyError.value =
        error instanceof ReadionProblemDetailsError
          ? (error.detail ?? error.title)
          : 'Re-verification could not be started. Please try again.'
    }
  }

  async function submit(): Promise<void> {
    if (
      !activeCertId.value ||
      !diff.value ||
      !extractionFields.value ||
      confirmedSourceUrl.value === null
    ) {
      return
    }
    submitting.value = true
    reverifyError.value = null
    try {
      const body = reverifyCertificationRequestSchema.parse(
        buildReverifyBody(confirmedSourceUrl.value, diff.value.proposed, extractionFields.value),
      )
      await certSetupControllerReverify(activeCertId.value, {
        headers: jsonHeaders,
        body: JSON.stringify(body),
      })
      await onSubmitted?.()
      reset()
    } catch (error) {
      reverifyError.value =
        error instanceof ReadionProblemDetailsError
          ? (error.detail ?? error.title)
          : 'Re-verification failed. Please try again.'
    } finally {
      submitting.value = false
    }
  }

  return { activeCertId, currentCert, diff, reverifyError, submitting, start, submit, reset }
}
