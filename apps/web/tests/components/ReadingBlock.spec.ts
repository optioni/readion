import type { SessionItemResponse } from '@readion/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingBlock from '~/components/ReadingBlock.vue'
import { goDeeperOnItem } from '~/composables/sessionViewApi'

vi.mock('~/composables/sessionViewApi', () => ({ goDeeperOnItem: vi.fn() }))

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const readingItem: SessionItemResponse = {
  index: 0,
  type: 'reading',
  domain: 'IAM & Security',
  content: '**TL;DR** — SCPs are guardrails, not grants.',
  completed: false,
  sourceChunkIds: ['bb9dd4b7-e3e5-44e6-b006-1b6fd247e14b'],
  supportingSpans: ['AWS Organizations User Guide §SCP'],
}

function mountBlock(item: SessionItemResponse = readingItem, domain?: string) {
  return mount(ReadingBlock, { props: { sessionId: 'sess-1', item, domain } })
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
    expect(wrapper.text()).toContain('AWS Organizations User Guide §SCP')
  })

  it('never renders a raw content-chunk UUID as a citation chip label, falling back to a human label', () => {
    const wrapper = mountBlock()

    const chips = wrapper.findAll('[data-testid="citation-chip"]')
    for (const chip of chips) {
      expect(chip.text()).not.toMatch(UUID_PATTERN)
    }
    expect(wrapper.text()).toContain('Source')
  })

  it('renders the domain label beside the Reading pill when a domain is passed', () => {
    const wrapper = mountBlock(readingItem, 'IAM & Security')

    expect(wrapper.text()).toContain('IAM & Security')
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
