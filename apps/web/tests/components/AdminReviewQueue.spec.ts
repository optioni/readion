import type {
  CollectionMeta,
  QuarantinedItemDetail,
  QuarantinedItemListItem,
} from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, toValue } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminReviewQueue from '~/components/admin/AdminReviewQueue.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import { useAdminQuarantineDetail } from '~/composables/useAdminQuarantineDetail'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import {
  quarantineAdminControllerApprove,
  quarantineAdminControllerReject,
} from '~~/src/api/quarantine-admin/quarantine-admin'

vi.mock('~/composables/useAdminQuarantine', () => ({ useAdminQuarantine: vi.fn() }))
vi.mock('~/composables/useAdminQuarantineDetail', () => ({ useAdminQuarantineDetail: vi.fn() }))
vi.mock('~~/src/api/quarantine-admin/quarantine-admin')
vi.mock('~~/src/api/certifications/certifications')

const ITEM_A_ID = '00000000-0000-0000-0000-0000000000a1'
const ITEM_B_ID = '00000000-0000-0000-0000-0000000000b2'
const ITEM_C_ID = '00000000-0000-0000-0000-0000000000c1'
const CERT_ID = '00000000-0000-0000-0000-0000000000c3'
const CERT_ID_2 = '00000000-0000-0000-0000-0000000000c9'

const ITEM_A: QuarantinedItemListItem = {
  id: ITEM_A_ID,
  certificationId: CERT_ID,
  domain: 'Compute',
  verdict: JSON.stringify({ pass: false, score: 0.2 }),
  reason: 'The answer key is incorrect',
  status: 'pending',
  provenance: {
    sourceChunkIds: ['chunk-1'],
    supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
    verdict: { pass: false, score: 0.2, distractorFindings: [] },
    score: 0.2,
  },
  createdAt: '2026-06-20T10:00:00.000Z',
}

const ITEM_B: QuarantinedItemListItem = {
  id: ITEM_B_ID,
  certificationId: CERT_ID,
  domain: 'Storage',
  verdict: JSON.stringify({ pass: false, score: 0.4 }),
  reason: 'Hallucinated distractor',
  status: 'pending',
  provenance: {
    sourceChunkIds: ['chunk-2'],
    supportingSpans: ['Amazon S3 stores objects'],
    verdict: { pass: false, score: 0.4, distractorFindings: [] },
    score: 0.4,
  },
  createdAt: '2026-06-21T10:00:00.000Z',
}

const ITEM_C: QuarantinedItemListItem = {
  id: ITEM_C_ID,
  certificationId: CERT_ID_2,
  domain: 'Networking',
  verdict: JSON.stringify({ pass: true, score: 0.9 }),
  reason: 'Looks fine',
  status: 'pending',
  provenance: {
    sourceChunkIds: ['chunk-3'],
    supportingSpans: ['Amazon VPC connects resources'],
    verdict: { pass: true, score: 0.9, distractorFindings: [] },
    score: 0.9,
  },
  createdAt: '2026-06-22T10:00:00.000Z',
}

const ITEMS: QuarantinedItemListItem[] = [ITEM_A, ITEM_B]

const CERTS = [
  {
    id: CERT_ID,
    name: 'AWS Certified Solutions Architect',
    provider: 'AWS',
    code: 'SAA-C03',
    domains: [],
    questionCount: 65,
    passingScore: 72,
    timeLimitMinutes: 130,
    state: 'live',
  },
  {
    id: CERT_ID_2,
    name: 'Azure Fundamentals',
    provider: 'Microsoft',
    code: 'AZ-900',
    domains: [],
    questionCount: 40,
    passingScore: 700,
    timeLimitMinutes: 60,
    state: 'published',
  },
]

const DETAIL_A: QuarantinedItemDetail = {
  ...ITEM_A,
  content: {
    question: 'Which AWS service provides scalable object storage?',
    options: ['Amazon EC2', 'Amazon S3', 'Amazon RDS', 'Amazon VPC'],
    answerKey: 'Amazon S3',
    format: 'multiple_choice',
    supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
    sourceChunkIds: ['chunk-1'],
  },
}

const DETAIL_B: QuarantinedItemDetail = {
  ...ITEM_B,
  content: {
    question: 'Which AWS service is a fully managed relational database?',
    options: ['Amazon RDS', 'Amazon S3', 'AWS Lambda', 'Amazon CloudFront'],
    answerKey: 'Amazon RDS',
    format: 'multiple_choice',
    supportingSpans: ['Amazon S3 stores objects'],
    sourceChunkIds: ['chunk-2'],
  },
}

const META: CollectionMeta = { total: 2, page: 1, limit: 25 }
const quarantineRefetch = vi.fn()

function stubQuarantine(
  items: QuarantinedItemListItem[] = ITEMS,
  options: { isLoading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useAdminQuarantine).mockReturnValue({
    data: computed(() => ({ data: items, meta: META })),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    refetch: quarantineRefetch,
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
}

function stubQuarantineDetail() {
  vi.mocked(useAdminQuarantineDetail).mockImplementation(
    (id) =>
      ({
        data: computed(() => {
          const value = toValue(id)
          if (value === ITEM_A_ID) return DETAIL_A
          if (value === ITEM_B_ID) return DETAIL_B
          return undefined
        }),
        isLoading: computed(() => false),
        isError: computed(() => false),
        // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
      }) as any,
  )
}

function mountQueue() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(AdminReviewQueue, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, invalidateSpy }
}

function rowFor(wrapper: ReturnType<typeof mountQueue>['wrapper'], itemId: string) {
  return wrapper.find(`[data-testid="review-queue-item"][data-item-id="${itemId}"]`)
}

const okResolution = (id: string, status: string) => ({
  data: { data: { id, status } },
  status: 200,
  headers: new Headers(),
})

beforeEach(() => {
  vi.mocked(certificationsControllerList).mockResolvedValue({
    data: { data: CERTS, meta: { total: CERTS.length, page: 1, limit: 20 } },
    status: 200,
    headers: new Headers(),
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  } as any)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdminReviewQueue render', () => {
  it('renders the page root and one selectable row per quarantined item', () => {
    stubQuarantine()
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="admin-review-queue-page"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(2)
  })

  it('does not render the honest placeholder once the queue is backed by the API', () => {
    stubQuarantine()
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-placeholder"]').exists()).toBe(false)
  })

  it('shows a loading state and no rows while the query is loading', () => {
    stubQuarantine([], { isLoading: true })
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="admin-review-queue-loading"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
  })

  it('shows an error state when the query fails', () => {
    stubQuarantine([], { isError: true })
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="admin-review-queue-error"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
  })

  it('preserves successful queue rows when a background refresh fails', () => {
    stubQuarantine(ITEMS, { isError: true })
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="admin-review-queue-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="review-queue-empty"]').exists()).toBe(false)
  })

  it('retries the failed queue read once per activation', async () => {
    stubQuarantine([], { isError: true })
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    await wrapper.find('[data-testid="admin-async-retry-btn"]').trigger('click')

    expect(quarantineRefetch).toHaveBeenCalledTimes(1)
  })

  it('shows an empty state when there are no pending items', () => {
    stubQuarantine([])
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
  })

  it('keeps the detail pane mounted in its empty state alongside the empty queue message', () => {
    stubQuarantine([])
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-detail-empty"]').exists()).toBe(true)
  })
})

describe('AdminReviewQueue selection and detail', () => {
  it('shows the detail-empty state and no detail pane before any selection', () => {
    stubQuarantine()
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-detail-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-detail"]').exists()).toBe(false)
  })

  it('loads and renders the selected item detail on row click', async () => {
    stubQuarantine()
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    await rowFor(wrapper, ITEM_A_ID).trigger('click')
    await flushPromises()

    const detail = wrapper.find('[data-testid="review-queue-detail"]')
    expect(detail.exists()).toBe(true)
    expect(detail.find('[data-testid="review-queue-question"]').text()).toContain(
      'Which AWS service provides scalable object storage?',
    )
  })
})

describe('AdminReviewQueue approve', () => {
  it('approves the selected item, invalidates the queue, and resets to the empty detail state', async () => {
    stubQuarantine()
    stubQuarantineDetail()
    vi.mocked(quarantineAdminControllerApprove).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okResolution(ITEM_A_ID, 'approved') as any,
    )
    const { wrapper, invalidateSpy } = mountQueue()

    await rowFor(wrapper, ITEM_A_ID).trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="approve-item-btn"]').trigger('click')
    await flushPromises()

    expect(quarantineAdminControllerApprove).toHaveBeenCalledWith(ITEM_A_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.quarantine() })
    expect(wrapper.find('[data-testid="review-queue-detail-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-detail"]').exists()).toBe(false)
  })

  it('shows only Approve as busy and rejects duplicate approval while pending', async () => {
    stubQuarantine()
    stubQuarantineDetail()
    let resolveApprove: ((value: ReturnType<typeof okResolution>) => void) | undefined
    vi.mocked(quarantineAdminControllerApprove).mockReturnValue(
      new Promise((resolve) => {
        resolveApprove = resolve
      }) as never,
    )
    const { wrapper } = mountQueue()

    await rowFor(wrapper, ITEM_A_ID).trigger('click')
    await flushPromises()

    const approve = wrapper.find('[data-testid="approve-item-btn"]')
    await approve.trigger('click')
    await flushPromises()

    const reject = wrapper.find('[data-testid="reject-item-btn"]')
    expect(approve.attributes('aria-busy')).toBe('true')
    expect(approve.text()).toContain('Approving…')
    expect(reject.attributes('disabled')).toBeDefined()
    expect(reject.attributes('aria-busy')).toBeUndefined()

    await approve.trigger('click')
    expect(quarantineAdminControllerApprove).toHaveBeenCalledTimes(1)

    resolveApprove?.(okResolution(ITEM_A_ID, 'approved'))
    await flushPromises()
  })
})

describe('AdminReviewQueue reject', () => {
  it('rejects the selected item and invalidates the quarantine queue', async () => {
    stubQuarantine()
    stubQuarantineDetail()
    vi.mocked(quarantineAdminControllerReject).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okResolution(ITEM_B_ID, 'rejected') as any,
    )
    const { wrapper, invalidateSpy } = mountQueue()

    await rowFor(wrapper, ITEM_B_ID).trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="reject-item-btn"]').trigger('click')
    await flushPromises()

    expect(quarantineAdminControllerReject).toHaveBeenCalledWith(ITEM_B_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.quarantine() })
    expect(wrapper.find('[data-testid="review-queue-detail-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-detail"]').exists()).toBe(false)
  })

  it('surfaces a conflict message when an item was already resolved', async () => {
    stubQuarantine()
    stubQuarantineDetail()
    vi.mocked(quarantineAdminControllerReject).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Conflict',
        status: 409,
        detail: 'Quarantined item has already been resolved',
      }),
    )
    const { wrapper, invalidateSpy } = mountQueue()

    await rowFor(wrapper, ITEM_B_ID).trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="reject-item-btn"]').trigger('click')
    await flushPromises()

    const error = wrapper.find('[data-testid="review-queue-error-banner"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('already been resolved')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('preserves the reviewed evidence and restores Reject after an RFC 7807 failure', async () => {
    stubQuarantine()
    stubQuarantineDetail()
    vi.mocked(quarantineAdminControllerReject).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'The rejection reason could not be recorded.',
      }),
    )
    const { wrapper } = mountQueue()

    await rowFor(wrapper, ITEM_B_ID).trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="reject-item-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="review-queue-evidence-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-action-error"]').text()).toContain(
      'The rejection reason could not be recorded.',
    )
    expect(wrapper.find('[data-testid="reject-item-btn"]').attributes('disabled')).toBeUndefined()
  })
})

describe('AdminReviewQueue awaiting count and certification filters', () => {
  it('shows the N items awaiting review count from the collection meta total', () => {
    stubQuarantine()
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-awaiting-count"]').text()).toContain(
      '2 items awaiting review',
    )
  })

  it('renders an All chip plus one chip per certification represented in the queue, and filters the list on click', async () => {
    stubQuarantine([ITEM_A, ITEM_B, ITEM_C])
    stubQuarantineDetail()
    const { wrapper } = mountQueue()
    await flushPromises()

    const chips = wrapper.findAll('[data-testid="review-queue-cert-chip"]')
    expect(chips).toHaveLength(3)

    const allChip = wrapper.find('[data-testid="review-queue-cert-chip"][data-cert-id="all"]')
    expect(allChip.exists()).toBe(true)

    const certChip = wrapper.find(
      `[data-testid="review-queue-cert-chip"][data-cert-id="${CERT_ID_2}"]`,
    )
    expect(certChip.exists()).toBe(true)

    await certChip.trigger('click')

    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(1)
    expect(rowFor(wrapper, ITEM_C_ID).exists()).toBe(true)

    await allChip.trigger('click')

    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(3)
  })

  it('shows a resolved certification badge and formatted verdict badge on each row', async () => {
    stubQuarantine()
    stubQuarantineDetail()
    const { wrapper } = mountQueue()
    await flushPromises()

    const rowA = rowFor(wrapper, ITEM_A_ID)
    expect(rowA.find('[data-testid="review-queue-item-id"]').text()).toBe(ITEM_A_ID)
    expect(rowA.find('[data-testid="review-queue-item-cert"]').text()).toContain('SAA-C03')
    const verdictBadge = rowA.find('[data-testid="review-queue-item-verdict"]')
    expect(verdictBadge.text()).toContain('Failed')
    expect(verdictBadge.text()).toContain('20%')
    expect(wrapper.text()).not.toContain('{"pass"')
  })
})
