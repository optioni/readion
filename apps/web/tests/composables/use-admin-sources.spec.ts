import type { ContentSourceResponse, IngestionJobStatus } from '@readion/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminSources, useSourceJobs } from '~/composables/useAdminSources'
import { contentControllerList, contentControllerListJobs } from '~~/src/api/content/content'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/content/content')

const CERT_ID = 'c0000000-0000-0000-0000-000000000001'
const SOURCE_ID = 'd0000000-0000-0000-0000-000000000001'

const SOURCES: ContentSourceResponse[] = [
  {
    id: SOURCE_ID,
    certificationId: CERT_ID,
    type: 'web',
    url: 'https://docs.aws.amazon.com/',
    enabled: true,
    lastFetchedAt: null,
    recheckIntervalMinutes: 10080,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

const JOBS: IngestionJobStatus[] = [
  {
    jobId: 'j1',
    state: 'completed',
    progress: 100,
    attemptsMade: 1,
    failedReason: null,
    timestamp: 1,
    processedOn: 1,
    finishedOn: 1,
  },
]

const sourcesEnvelope = { data: { data: SOURCES }, status: 200, headers: new Headers() }
const jobsEnvelope = { data: { data: JOBS }, status: 200, headers: new Headers() }

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAdminSources', () => {
  it('lists and narrows the content-sources envelope for the certification', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(contentControllerList).mockResolvedValue(sourcesEnvelope as any)

    const { result, queryClient } = renderComposable(() => useAdminSources(CERT_ID))

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(SOURCES)
    })
    expect(contentControllerList).toHaveBeenCalledWith({ certificationId: CERT_ID })
    expect(queryClient.getQueryData(adminQueryKeys.contentSources(CERT_ID))).toEqual(SOURCES)
  })

  it('does not fetch without a certification id', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(contentControllerList).mockResolvedValue(sourcesEnvelope as any)

    renderComposable(() => useAdminSources(''))

    await Promise.resolve()
    expect(contentControllerList).not.toHaveBeenCalled()
  })
})

describe('useSourceJobs', () => {
  it('fetches jobs per source and keys them by source id', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(contentControllerListJobs).mockResolvedValue(jobsEnvelope as any)

    const { result } = renderComposable(() => useSourceJobs(CERT_ID, SOURCES))

    await vi.waitFor(() => {
      expect(result.data.value).toEqual({ [SOURCE_ID]: JOBS })
    })
    expect(contentControllerListJobs).toHaveBeenCalledWith(SOURCE_ID)
  })

  it('stays idle when there are no sources', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    vi.mocked(contentControllerListJobs).mockResolvedValue(jobsEnvelope as any)

    renderComposable(() => useSourceJobs(CERT_ID, []))

    await Promise.resolve()
    expect(contentControllerListJobs).not.toHaveBeenCalled()
  })
})
