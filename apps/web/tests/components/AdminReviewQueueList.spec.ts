import type { QuarantinedItemListItem } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminReviewQueueList from '~/components/admin/AdminReviewQueueList.vue'

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

function rowFor(wrapper: ReturnType<typeof mount>, itemId: string) {
  return wrapper.find(`[data-testid="review-queue-item"][data-item-id="${itemId}"]`)
}

const CERTS_BY_ID = {
  [CERT_ID]: { name: 'AWS Certified Solutions Architect', code: 'SAA-C03' },
}

describe('AdminReviewQueueList', () => {
  it('renders one row per item with its id set as data-item-id', () => {
    const wrapper = mount(AdminReviewQueueList, { props: { items: ITEMS, selectedId: null } })

    expect(wrapper.findAll('[data-testid="review-queue-item"]')).toHaveLength(2)
    expect(rowFor(wrapper, ITEM_A_ID).exists()).toBe(true)
    expect(rowFor(wrapper, ITEM_B_ID).exists()).toBe(true)
  })

  it('emits select with the item id when a row is clicked', async () => {
    const wrapper = mount(AdminReviewQueueList, { props: { items: ITEMS, selectedId: null } })

    await rowFor(wrapper, ITEM_B_ID).trigger('click')

    expect(wrapper.emitted('select')).toEqual([[ITEM_B_ID]])
  })

  it('marks the selected row distinctly from unselected rows', () => {
    const wrapper = mount(AdminReviewQueueList, { props: { items: ITEMS, selectedId: ITEM_A_ID } })

    expect(rowFor(wrapper, ITEM_A_ID).attributes('data-selected')).toBe('true')
    expect(rowFor(wrapper, ITEM_B_ID).attributes('data-selected')).toBe('false')
  })
})

describe('AdminReviewQueueList metadata', () => {
  it('shows the full item id in a mono id element', () => {
    const wrapper = mount(AdminReviewQueueList, {
      props: { items: ITEMS, selectedId: null, certsById: CERTS_BY_ID },
    })

    expect(rowFor(wrapper, ITEM_A_ID).find('[data-testid="review-queue-item-id"]').text()).toBe(
      ITEM_A_ID,
    )
  })

  it('shows a certification badge resolved from the certsById lookup', () => {
    const wrapper = mount(AdminReviewQueueList, {
      props: { items: ITEMS, selectedId: null, certsById: CERTS_BY_ID },
    })

    expect(
      rowFor(wrapper, ITEM_A_ID).find('[data-testid="review-queue-item-cert"]').text(),
    ).toContain('SAA-C03')
  })

  it('shows a human-formatted verdict badge derived from provenance, never the raw JSON verdict string', () => {
    const wrapper = mount(AdminReviewQueueList, {
      props: { items: ITEMS, selectedId: null, certsById: CERTS_BY_ID },
    })

    const badge = rowFor(wrapper, ITEM_A_ID).find('[data-testid="review-queue-item-verdict"]')
    expect(badge.text()).toContain('Failed')
    expect(badge.text()).toContain('20%')
    expect(wrapper.text()).not.toContain('{"pass"')
  })
})
