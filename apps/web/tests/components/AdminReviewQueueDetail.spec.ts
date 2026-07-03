import type { QuarantinedItemDetail } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import AdminReviewQueueDetail from '~/components/admin/AdminReviewQueueDetail.vue'
import { useAdminQuarantineDetail } from '~/composables/useAdminQuarantineDetail'

vi.mock('~/composables/useAdminQuarantineDetail', () => ({ useAdminQuarantineDetail: vi.fn() }))

const ITEM_ID = 'f0000000-0000-0000-0000-000000000001'

const DETAIL: QuarantinedItemDetail = {
  id: ITEM_ID,
  certificationId: 'c0000000-0000-0000-0000-000000000001',
  domain: 'Storage',
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
  content: {
    question: 'Which AWS service provides scalable object storage?',
    options: ['Amazon EC2', 'Amazon S3', 'Amazon RDS', 'Amazon VPC'],
    answerKey: 'Amazon S3',
    format: 'multiple_choice',
    supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
    sourceChunkIds: ['chunk-1'],
  },
}

function stubDetail(
  data: QuarantinedItemDetail | undefined,
  options: { isLoading?: boolean } = {},
) {
  vi.mocked(useAdminQuarantineDetail).mockReturnValue({
    data: computed(() => data),
    isLoading: computed(() => options.isLoading ?? false),
    isError: computed(() => false),
    // biome-ignore lint/suspicious/noExplicitAny: vue-query return shape narrowed in tests
  } as any)
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdminReviewQueueDetail empty state', () => {
  it('shows the empty state and does not request detail when there is no selected id', () => {
    stubDetail(undefined)
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: null } })

    expect(wrapper.find('[data-testid="review-queue-detail-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-detail"]').exists()).toBe(false)
    expect(useAdminQuarantineDetail).toHaveBeenCalled()
  })
})

describe('AdminReviewQueueDetail loading state', () => {
  it('shows a loading indicator while the fetch is in flight', () => {
    stubDetail(undefined, { isLoading: true })
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID } })

    expect(wrapper.find('[data-testid="review-queue-detail-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-queue-detail"]').exists()).toBe(false)
  })
})

describe('AdminReviewQueueDetail loaded state', () => {
  it('renders question, options, the marked answer key and a human-formatted verdict', () => {
    stubDetail(DETAIL)
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID } })

    const detail = wrapper.find('[data-testid="review-queue-detail"]')
    expect(detail.exists()).toBe(true)
    expect(detail.find('[data-testid="review-queue-detail-empty"]').exists()).toBe(false)

    expect(detail.find('[data-testid="review-queue-question"]').text()).toContain(
      'Which AWS service provides scalable object storage?',
    )

    const options = detail.findAll('[data-testid="review-queue-option"]')
    expect(options).toHaveLength(4)

    const marked = detail.findAll('[data-testid="review-queue-option"][data-answer-key="true"]')
    expect(marked).toHaveLength(1)
    expect(marked[0]?.text()).toContain('Amazon S3')

    expect(detail.find('[data-testid="review-queue-answer-key"]').text()).toContain('Amazon S3')

    const verdict = detail.find('[data-testid="review-queue-verdict"]')
    expect(verdict.text()).toMatch(/fail/i)
    expect(verdict.text()).toContain('20%')
    expect(verdict.text()).toContain('The answer key is incorrect')
    expect(verdict.text()).not.toContain('{"pass":false')

    expect(detail.find('[data-testid="review-queue-reason"]').text()).toContain(
      'The answer key is incorrect',
    )
    expect(detail.find('[data-testid="review-queue-provenance"]').text()).toContain('chunk-1')

    expect(detail.find('[data-testid="approve-item-btn"]').exists()).toBe(true)
    expect(detail.find('[data-testid="reject-item-btn"]').exists()).toBe(true)
  })

  it('never renders the raw verdict JSON string anywhere', () => {
    stubDetail(DETAIL)
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID } })

    expect(wrapper.text()).not.toContain('{"pass":false')
    expect(wrapper.text()).not.toContain('"score":0.2')
  })

  it('emits approve with the item id when the approve button is clicked', async () => {
    stubDetail(DETAIL)
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID } })

    await wrapper.find('[data-testid="approve-item-btn"]').trigger('click')

    expect(wrapper.emitted('approve')).toEqual([[ITEM_ID]])
  })

  it('emits reject with the item id when the reject button is clicked', async () => {
    stubDetail(DETAIL)
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID } })

    await wrapper.find('[data-testid="reject-item-btn"]').trigger('click')

    expect(wrapper.emitted('reject')).toEqual([[ITEM_ID]])
  })

  it('disables the resolve buttons while the item id matches pendingId', () => {
    stubDetail(DETAIL)
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID, pendingId: ITEM_ID } })

    expect(wrapper.find('[data-testid="approve-item-btn"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="reject-item-btn"]').attributes('disabled')).toBeDefined()
  })

  it('falls back to provenance.score when the nested verdict is absent (legacy/mocked payloads)', () => {
    const legacyDetail = {
      ...DETAIL,
      provenance: {
        sourceChunkIds: ['chunk-1'],
        supportingSpans: [],
        score: 0.2,
        // biome-ignore lint/suspicious/noExplicitAny: simulating a payload missing the nested verdict
      } as any,
    }
    stubDetail(legacyDetail)
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID } })

    const verdict = wrapper.find('[data-testid="review-queue-verdict"]')
    expect(verdict.text()).toContain('20%')
    expect(verdict.text()).toMatch(/fail/i)
  })
})

describe('AdminReviewQueueDetail no-content state', () => {
  it('shows the no-content state while verdict, reason and provenance still render', () => {
    stubDetail({ ...DETAIL, content: null })
    const wrapper = mount(AdminReviewQueueDetail, { props: { id: ITEM_ID } })

    const detail = wrapper.find('[data-testid="review-queue-detail"]')
    expect(detail.find('[data-testid="review-queue-detail-no-content"]').exists()).toBe(true)
    expect(detail.find('[data-testid="review-queue-question"]').exists()).toBe(false)
    expect(detail.find('[data-testid="review-queue-option"]').exists()).toBe(false)

    expect(detail.find('[data-testid="review-queue-verdict"]').exists()).toBe(true)
    expect(detail.find('[data-testid="review-queue-reason"]').exists()).toBe(true)
    expect(detail.find('[data-testid="review-queue-provenance"]').text()).toContain('chunk-1')
  })
})
