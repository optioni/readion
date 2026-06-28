import type { SessionItemResponse } from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingBlock from '~/components/ReadingBlock.vue'
import { goDeeperOnItem } from '~/composables/sessionViewApi'

vi.mock('~/composables/sessionViewApi', () => ({ goDeeperOnItem: vi.fn() }))

const readingItem: SessionItemResponse = {
  index: 0,
  type: 'reading',
  content: '**TL;DR** — SCPs are guardrails, not grants.',
  completed: false,
  sourceChunkIds: ['chunk-scp-001'],
  supportingSpans: ['AWS Organizations User Guide §SCP'],
}

function mountBlock(item: SessionItemResponse = readingItem) {
  return mount(ReadingBlock, { props: { sessionId: 'sess-1', item } })
}

beforeEach(() => {
  vi.mocked(goDeeperOnItem).mockResolvedValue({ expandedContent: 'SCPs attach to the org root.' })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ReadingBlock rendering', () => {
  it('renders the TL;DR markdown content', () => {
    const wrapper = mountBlock()

    const tldr = wrapper.find('[data-testid="reading-tldr"]')
    expect(tldr.exists()).toBe(true)
    expect(tldr.html()).toContain('<strong>TL;DR</strong>')
    expect(tldr.text()).toContain('guardrails')
  })

  it('renders one citation chip per provenance source', () => {
    const wrapper = mountBlock()

    const chips = wrapper.findAll('[data-testid="citation-chip"]')
    expect(chips).toHaveLength(2)
    expect(wrapper.text()).toContain('chunk-scp-001')
    expect(wrapper.text()).toContain('AWS Organizations User Guide §SCP')
  })
})

describe('ReadingBlock go-deeper', () => {
  it('fetches the expanded explanation once and renders it', async () => {
    const wrapper = mountBlock()

    await wrapper.find('[data-testid="read-full-explanation-button"]').trigger('click')
    await flushPromises()

    expect(goDeeperOnItem).toHaveBeenCalledWith('sess-1', 0)
    expect(goDeeperOnItem).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('SCPs attach to the org root.')
  })

  it('does not re-fetch when the button is pressed again', async () => {
    const wrapper = mountBlock()
    const button = wrapper.find('[data-testid="read-full-explanation-button"]')

    await button.trigger('click')
    await flushPromises()
    if (wrapper.find('[data-testid="read-full-explanation-button"]').exists()) {
      await wrapper.find('[data-testid="read-full-explanation-button"]').trigger('click')
      await flushPromises()
    }

    expect(goDeeperOnItem).toHaveBeenCalledTimes(1)
  })
})

describe('ReadingBlock advance', () => {
  it('emits advance with the item index when the advance button is clicked', async () => {
    const wrapper = mountBlock()

    await wrapper.find('[data-testid="advance-item-button"]').trigger('click')

    expect(wrapper.emitted('advance')?.at(-1)).toEqual([0])
  })
})
