import type { CollectionMeta, QuarantinedItemListItem } from '@readion/shared'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import AdminReviewQueue from '~/components/admin/AdminReviewQueue.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import {
  quarantineAdminControllerApprove,
  quarantineAdminControllerReject,
} from '~~/src/api/quarantine-admin/quarantine-admin'

vi.mock('~/composables/useAdminQuarantine', () => ({ useAdminQuarantine: vi.fn() }))
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
  it('renders the page root and one row per quarantined item with verdict, reason and provenance', () => {
    stubQuarantine()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="admin-review-queue-page"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(2)

    const rowA = rowFor(wrapper, ITEM_A_ID)
    expect(rowA.find('[data-testid="review-queue-verdict"]').exists()).toBe(true)
    expect(rowA.find('[data-testid="review-queue-reason"]').text()).toContain(
      'The answer key is incorrect',
    )
    expect(rowA.find('[data-testid="review-queue-provenance"]').text()).toContain('chunk-1')
  })

  it('does not render the honest placeholder once the queue is backed by the API', () => {
    stubQuarantine()
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-placeholder"]').exists()).toBe(false)
  })

  it('shows a loading state and no rows while the query is loading', () => {
    stubQuarantine([], { isLoading: true })
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="admin-review-queue-loading"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
  })

  it('shows an error state when the query fails', () => {
    stubQuarantine([], { isError: true })
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="admin-review-queue-error"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
  })

  it('shows an empty state when there are no pending items', () => {
    stubQuarantine([])
    const { wrapper } = mountQueue()

    expect(wrapper.find('[data-testid="review-queue-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(0)
  })
})

describe('AdminReviewQueue approve', () => {
  it('approves a pending item and invalidates the quarantine queue', async () => {
    stubQuarantine()
    vi.mocked(quarantineAdminControllerApprove).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okResolution(ITEM_A_ID, 'approved') as any,
    )
    const { wrapper, invalidateSpy } = mountQueue()

    await rowFor(wrapper, ITEM_A_ID).find('[data-testid="approve-item-btn"]').trigger('click')
    await flushPromises()

    expect(quarantineAdminControllerApprove).toHaveBeenCalledWith(ITEM_A_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.quarantine() })
  })
})

describe('AdminReviewQueue reject', () => {
  it('rejects a pending item and invalidates the quarantine queue', async () => {
    stubQuarantine()
    vi.mocked(quarantineAdminControllerReject).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okResolution(ITEM_B_ID, 'rejected') as any,
    )
    const { wrapper, invalidateSpy } = mountQueue()

    await rowFor(wrapper, ITEM_B_ID).find('[data-testid="reject-item-btn"]').trigger('click')
    await flushPromises()

    expect(quarantineAdminControllerReject).toHaveBeenCalledWith(ITEM_B_ID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.quarantine() })
  })

  it('surfaces a conflict message when an item was already resolved', async () => {
    stubQuarantine()
    vi.mocked(quarantineAdminControllerReject).mockRejectedValue(
      new ReadionProblemDetailsError({
        title: 'Conflict',
        status: 409,
        detail: 'Quarantined item has already been resolved',
      }),
    )
    const { wrapper, invalidateSpy } = mountQueue()

    await rowFor(wrapper, ITEM_B_ID).find('[data-testid="reject-item-btn"]').trigger('click')
    await flushPromises()

    const error = wrapper.find('[data-testid="review-queue-error-banner"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('already been resolved')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
