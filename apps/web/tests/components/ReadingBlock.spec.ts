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

function mountBlock(
  item: SessionItemResponse = readingItem,
  domain?: string,
  attachToDocument = false,
) {
  return mount(ReadingBlock, {
    props: { sessionId: 'sess-1', item, domain },
    attachTo: attachToDocument ? document.body : undefined,
  })
}

beforeEach(() => {
  vi.mocked(goDeeperOnItem).mockResolvedValue({ expandedContent: 'SCPs attach to the org root.' })
})

afterEach(() => {
  vi.resetAllMocks()
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
  it('keeps the TLDR and citations visible while loading and rejects duplicate requests', async () => {
    let resolveExplanation!: (value: { expandedContent: string }) => void
    vi.mocked(goDeeperOnItem).mockReturnValue(
      new Promise((resolve) => {
        resolveExplanation = resolve
      }),
    )
    const wrapper = mountBlock()
    const button = wrapper.find('[data-testid="read-full-explanation-button"]')

    await button.trigger('click')
    await button.trigger('click')

    expect(goDeeperOnItem).toHaveBeenCalledTimes(1)
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toContain('Loading…')
    expect(wrapper.find('[data-testid="reading-tldr"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="citation-chip"]')).toHaveLength(2)

    resolveExplanation({ expandedContent: 'Expanded.' })
  })

  it('shows an inline error and succeeds on an explicit retry without losing focus', async () => {
    vi.mocked(goDeeperOnItem)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ expandedContent: 'Recovered explanation.' })
    const wrapper = mountBlock(readingItem, undefined, true)
    const button = wrapper.find('[data-testid="read-full-explanation-button"]')
    ;(button.element as HTMLElement).focus()

    await button.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="reading-expansion-error"]').attributes('role')).toBe('alert')
    expect(wrapper.find('[data-testid="read-full-explanation-button"]').text()).toContain('Retry')
    expect(document.activeElement).toBe(
      wrapper.find('[data-testid="read-full-explanation-button"]').element,
    )

    await wrapper.find('[data-testid="read-full-explanation-button"]').trigger('click')
    await flushPromises()

    expect(goDeeperOnItem).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Recovered explanation.')
    expect(wrapper.find('[data-testid="reading-expansion-error"]').exists()).toBe(false)
    expect(document.activeElement).toBe(
      wrapper.get('[data-testid="reading-expanded-content"]').element,
    )
    wrapper.unmount()
  })

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
