import type { CollectionMeta, QuarantinedItemDetail, QuarantinedItemListItem } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, toValue } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminReviewQueue from '~/components/admin/AdminReviewQueue.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import { useAdminQuarantineDetail } from '~/composables/useAdminQuarantineDetail'
import {
  quarantineAdminControllerApprove,
  quarantineAdminControllerReject,
} from '~~/src/api/quarantine-admin/quarantine-admin'

vi.mock('~/composables/useAdminQuarantine', () => ({ useAdminQuarantine: vi.fn() }))
vi.mock('~/composables/useAdminQuarantineDetail', () => ({ useAdminQuarantineDetail: vi.fn() }))
vi.mock('~~/src/api/quarantine-admin/quarantine-admin')

const ITEM_A_ID = '00000000-0000-0000-0000-0000000000a1'
const ITEM_B_ID = '00000000-0000-0000-0000-0000000000b2'
const CERT_ID = '00000000-0000-0000-0000-0000000000c3'

const ITEMS: QuarantinedItemListItem[] = [
  {
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
  },
  {
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
  },
]

const DETAIL_A: QuarantinedItemDetail = {
  ...ITEMS[0]!,
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
  ...ITEMS[1]!,
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

function stubQuarantine(
  items: QuarantinedItemListItem[] = ITEMS,
  options: { isLoading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useAdminQuarantine).mockReturnValue({
    data: computed(() => ({ data: items, meta: META })),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => options.isError ?? false),
    refetch: vi.fn(),
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

  it('shows an empty state when there are no pending items', () => {
    stubQuarantine([])
    stubQuarantineDetail()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
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
})
