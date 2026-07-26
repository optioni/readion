import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { computePaceRate } from '~/composables/paceFormatter'
import {
  fetchCertificationDetail,
  fetchEnrollmentDetail,
  fetchEnrollmentMockExams,
  fetchEnrollments,
  fetchReadiness,
  fetchSessions,
  fetchWeakAreas,
} from '~/composables/progressApi'
import { progressQueryKeys } from '~/composables/progressQueryKeys'
import { fetchSessionSummary } from '~/composables/sessionViewApi'
import { useAccuracySeries } from '~/composables/useAccuracySeries'
import { useDomainScores } from '~/composables/useDomainScores'
import { useReadinessTrend } from '~/composables/useReadinessTrend'
import { useSessionHistoryMerge } from '~/composables/useSessionHistoryMerge'
import { useSuppressedDomains } from '~/composables/useSuppressedDomains'
import type { SessionSummaryResponseDto } from '~~/src/api/model'

export interface SwitcherEntry {
  enrollmentId: string
  certName: string
}

export interface ProgressRegionState {
  loading: boolean
  error?: string
  refreshing: boolean
}

export function useProgressData(enrollmentId: string) {
  const queryClient = useQueryClient()

  // 1. Enrollment detail — drives certificationId and 404 detection
  const enrollmentQuery = useQuery({
    queryKey: ['progress', 'enrollment', enrollmentId] as const,
    queryFn: () => fetchEnrollmentDetail(enrollmentId),
    retry: false,
  })

  const notFound = computed(() => {
    const error = enrollmentQuery.error.value
    return error instanceof ReadionProblemDetailsError && error.status === 404
  })

  const certificationId = computed(() => enrollmentQuery.data.value?.data.certificationId ?? null)

  // 2. Certification detail — drives cert name and domain list
  const certQuery = useQuery({
    queryKey: computed(() => progressQueryKeys.certification(certificationId.value ?? '')),
    queryFn: () => fetchCertificationDetail(certificationId.value as string),
    enabled: computed(() => certificationId.value !== null),
  })

  // 3. Readiness — drives trend end-point, trajectory, and calibration state
  const readinessQuery = useQuery({
    queryKey: progressQueryKeys.readiness(enrollmentId),
    queryFn: () => fetchReadiness(enrollmentId),
    retry: false,
  })

  // 4. Weak areas — drives per-domain scores (0-1 scale from API)
  const weakAreasQuery = useQuery({
    queryKey: progressQueryKeys.weakAreas(enrollmentId),
    queryFn: () => fetchWeakAreas(enrollmentId),
  })

  // 4b. Suppressed domains — derives the mastered state from fetched data (not a local-only ref
  // that resets on reload); shares progressQueryKeys.reviewQueue with ProgressDomainRow's mutation
  // invalidation, so marking a domain mastered refetches this.
  const { suppressedDomains } = useSuppressedDomains(enrollmentId)

  // 5. Sessions + summary fan-out combined in one query (per useSessionsHistory pattern)
  const sessionsQuery = useQuery({
    queryKey: computed(() => progressQueryKeys.sessions(certificationId.value ?? '', 1, 50)),
    queryFn: async () => {
      const result = await fetchSessions({
        certificationId: certificationId.value as string,
        page: 1,
        limit: 50,
      })
      const sessions = result.data

      const completed = sessions.filter((s) => String(s.status) === 'completed')
      const entries = await Promise.all(
        completed.map(async (s) => {
          try {
            const summary = await queryClient.fetchQuery({
              queryKey: progressQueryKeys.sessionSummary(s.id),
              queryFn: () => fetchSessionSummary(s.id),
              staleTime: Number.POSITIVE_INFINITY,
            })
            return [s.id, summary] as const
          } catch {
            return null
          }
        }),
      )

      return {
        sessions,
        summariesMap: new Map(
          entries.filter((e): e is [string, SessionSummaryResponseDto] => e !== null),
        ),
      }
    },
    enabled: computed(() => certificationId.value !== null),
  })

  // 6. Mock exams
  const mockExamsQuery = useQuery({
    queryKey: progressQueryKeys.mockExams(enrollmentId),
    queryFn: () => fetchEnrollmentMockExams(enrollmentId),
  })

  // 7. All enrollments + per-cert names for the cert switcher
  const enrollmentsQuery = useQuery({
    queryKey: progressQueryKeys.enrollments(),
    queryFn: async (): Promise<SwitcherEntry[]> => {
      const result = await fetchEnrollments()
      const enrollments = result.data
      return Promise.all(
        enrollments.map(async (enrollment) => {
          try {
            const detail = await fetchCertificationDetail(enrollment.certificationId)
            return { enrollmentId: enrollment.id, certName: detail.data.name }
          } catch {
            return { enrollmentId: enrollment.id, certName: '' }
          }
        }),
      )
    },
  })

  // ─── Raw values ─────────────────────────────────────────────────────────────

  const sessions = computed(() => sessionsQuery.data.value?.sessions ?? [])
  const summariesMap = computed(
    () => sessionsQuery.data.value?.summariesMap ?? new Map<string, SessionSummaryResponseDto>(),
  )
  const mockExams = computed(() => mockExamsQuery.data.value?.data ?? [])
  const weakAreasRaw = computed(() => weakAreasQuery.data.value?.data ?? [])
  const domains = computed(() => certQuery.data.value?.data.domains ?? [])
  const readiness = computed(
    () =>
      readinessQuery.data.value ?? {
        calibrated: false as const,
        score: null,
        trajectory: null,
      },
  )

  // ─── Weak areas — API already returns 0-100 integers (SCORE_MAX = 100) ────────

  const scaledWeakAreas = computed(() => weakAreasRaw.value)

  // ─── Latest summary (for domain deltas) — most-recent completed session ─────
  // weakAreaDeltas.delta is already a 0-100 point difference (afterScore - beforeScore).

  const latestSummaryRaw = computed(() => {
    const completed = [...sessions.value]
      .filter((s) => String(s.status) === 'completed')
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))

    const latest = completed[0]
    if (!latest) {
      return null
    }
    return summariesMap.value.get(latest.id) ?? null
  })

  const scaledLatestSummary = computed(() => latestSummaryRaw.value)

  // ─── Pure derivations ────────────────────────────────────────────────────────

  const trend = computed(() =>
    useReadinessTrend(sessions.value, summariesMap.value, readiness.value),
  )

  // Accuracy series scaled to 0-100 for AccuracyBars display
  const accuracySeries = computed(() =>
    useAccuracySeries(sessions.value, summariesMap.value).map((p) => ({
      ...p,
      accuracy: Math.round(p.accuracy * 100),
    })),
  )

  const domainScores = computed(() =>
    useDomainScores(
      domains.value,
      scaledWeakAreas.value,
      scaledLatestSummary.value,
      suppressedDomains.value,
    ),
  )

  const historyRows = computed(() =>
    useSessionHistoryMerge(sessions.value, mockExams.value, summariesMap.value),
  )

  // ─── Derived cert info ───────────────────────────────────────────────────────

  const certName = computed(() => certQuery.data.value?.data.name ?? '')
  const certProvider = computed(() => certQuery.data.value?.data.provider ?? '')

  const weeksToReady = computed(() => {
    const traj = readiness.value.trajectory
    return traj?.weeksToReady ?? null
  })

  const paceRate = computed(() => computePaceRate(trend.value.points.map((p) => p.score)))

  const switcher = computed<SwitcherEntry[]>(() => enrollmentsQuery.data.value ?? [])

  // ─── Loading / error ─────────────────────────────────────────────────────────

  const isLoading = computed(
    () =>
      enrollmentQuery.isLoading.value ||
      (certificationId.value !== null && certQuery.isLoading.value) ||
      readinessQuery.isLoading.value,
  )

  const isError = computed(
    () => (enrollmentQuery.isError.value && !notFound.value) || certQuery.isError.value,
  )

  const summaryState = computed<ProgressRegionState>(() => {
    const loading = enrollmentQuery.isLoading.value || sessionsQuery.isLoading.value
    const error =
      enrollmentQuery.isError.value || sessionsQuery.isError.value
        ? 'Couldn’t load your activity summary.'
        : undefined
    return {
      loading,
      error,
      refreshing:
        !loading && !error && (enrollmentQuery.isFetching.value || sessionsQuery.isFetching.value),
    }
  })

  const trendState = computed<ProgressRegionState>(() => {
    const loading =
      enrollmentQuery.isLoading.value ||
      readinessQuery.isLoading.value ||
      sessionsQuery.isLoading.value
    const error =
      enrollmentQuery.isError.value || readinessQuery.isError.value || sessionsQuery.isError.value
        ? 'Couldn’t load readiness history.'
        : undefined
    return {
      loading,
      error,
      refreshing:
        !loading &&
        !error &&
        (enrollmentQuery.isFetching.value ||
          readinessQuery.isFetching.value ||
          sessionsQuery.isFetching.value),
    }
  })

  const domainState = computed<ProgressRegionState>(() => {
    const loading =
      enrollmentQuery.isLoading.value || certQuery.isLoading.value || weakAreasQuery.isLoading.value
    const error =
      enrollmentQuery.isError.value || certQuery.isError.value || weakAreasQuery.isError.value
        ? 'Couldn’t load domain scores.'
        : undefined
    return {
      loading,
      error,
      refreshing:
        !loading &&
        !error &&
        (enrollmentQuery.isFetching.value ||
          certQuery.isFetching.value ||
          weakAreasQuery.isFetching.value),
    }
  })

  const historyState = computed<ProgressRegionState>(() => {
    const loading =
      enrollmentQuery.isLoading.value ||
      sessionsQuery.isLoading.value ||
      mockExamsQuery.isLoading.value
    const error =
      enrollmentQuery.isError.value || sessionsQuery.isError.value || mockExamsQuery.isError.value
        ? 'Couldn’t load session history.'
        : undefined
    return {
      loading,
      error,
      refreshing:
        !loading &&
        !error &&
        (enrollmentQuery.isFetching.value ||
          sessionsQuery.isFetching.value ||
          mockExamsQuery.isFetching.value),
    }
  })

  async function retrySummary(): Promise<void> {
    if (enrollmentQuery.isError.value) {
      await enrollmentQuery.refetch()
    }
    if (certificationId.value !== null) {
      await sessionsQuery.refetch()
    }
  }

  async function retryTrend(): Promise<void> {
    if (enrollmentQuery.isError.value) {
      await enrollmentQuery.refetch()
    }
    await readinessQuery.refetch()
    if (certificationId.value !== null) {
      await sessionsQuery.refetch()
    }
  }

  async function retryDomains(): Promise<void> {
    if (enrollmentQuery.isError.value) {
      await enrollmentQuery.refetch()
    }
    await weakAreasQuery.refetch()
    if (certificationId.value !== null) {
      await certQuery.refetch()
    }
  }

  async function retryHistory(): Promise<void> {
    if (enrollmentQuery.isError.value) {
      await enrollmentQuery.refetch()
    }
    await mockExamsQuery.refetch()
    if (certificationId.value !== null) {
      await sessionsQuery.refetch()
    }
  }

  return {
    notFound,
    certName,
    certProvider,
    domains,
    domainScores,
    trend,
    accuracySeries,
    weeksToReady,
    paceRate,
    readiness,
    historyRows,
    sessions,
    summariesMap,
    switcher,
    isLoading,
    isError,
    summaryState,
    trendState,
    domainState,
    historyState,
    retrySummary,
    retryTrend,
    retryDomains,
    retryHistory,
  }
}
