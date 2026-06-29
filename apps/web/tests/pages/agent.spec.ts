import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import { fetchAgentConversation } from '~/composables/sessionViewApi'
import type { AgentStreamEvent } from '~/composables/useAgentTurnStream'
import AgentPage from '~/pages/agent.vue'

const { streamTurnMock } = vi.hoisted(() => ({ streamTurnMock: vi.fn() }))

vi.mock('~/composables/agentChatApi', () => ({
  createStandaloneAgentConversation: vi.fn(),
}))

vi.mock('~/composables/sessionViewApi', () => ({
  fetchAgentConversation: vi.fn(),
}))

vi.mock('~/composables/useAgentTurnStream', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useAgentTurnStream')>()
  return {
    ...actual,
    useAgentTurnStream: () => ({ streamTurn: streamTurnMock }),
  }
})

function standaloneConversationDetail(messages: unknown[] = []) {
  return {
    data: {
      id: 'conv-standalone-1',
      mode: 'standalone',
      studySessionId: null,
      certificationId: null,
      lastActivityAt: '2026-06-29T09:05:00.000Z',
      createdAt: '2026-06-29T09:05:00.000Z',
    },
    relationships: { messages: { data: messages } },
  }
}

function emitEvents(events: AgentStreamEvent[]) {
  streamTurnMock.mockImplementation(
    async (_id: string, _content: string, onEvent: (event: AgentStreamEvent) => void) => {
      for (const event of events) {
        onEvent(event)
      }
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  const createMock = vi.mocked(createStandaloneAgentConversation)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  createMock.mockResolvedValue(standaloneConversationDetail() as any)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchAgentConversation).mockResolvedValue(standaloneConversationDetail() as any)
  streamTurnMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

async function mountPage() {
  const wrapper = mount(AgentPage)
  await flushPromises()
  return wrapper
}

describe('Agent chat page lifecycle', () => {
  it('creates a standalone conversation exactly once on mount', async () => {
    const wrapper = await mountPage()

    expect(createStandaloneAgentConversation).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="agent-chat-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="agent-empty-state"]').exists()).toBe(true)
  })

  it('handles standalone mode response with null studySessionId and certificationId', async () => {
    const detail = standaloneConversationDetail()
    expect(detail.data.mode).toBe('standalone')
    expect(detail.data.studySessionId).toBeNull()
    expect(detail.data.certificationId).toBeNull()

    await mountPage()
    expect(createStandaloneAgentConversation).toHaveBeenCalledTimes(1)
  })
})

describe('Agent chat page scaffold', () => {
  it('renders the input bar with required controls', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="agent-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="agent-send-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="agent-new-chat-button"]').exists()).toBe(true)
  })
})

describe('Agent chat page message hydration', () => {
  it('hydrates prior messages after create and renders user/assistant bubbles in order; skips tool and system rows', async () => {
    const detailWithMessages = standaloneConversationDetail([
      { role: 'user', content: 'Hi', createdAt: '2026-06-29T09:05:00.000Z' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        createdAt: '2026-06-29T09:05:01.000Z',
      },
      { role: 'system', content: 'You are a tutor.', createdAt: '2026-06-29T09:05:02.000Z' },
      { role: 'tool', content: 'tool-output', createdAt: '2026-06-29T09:05:03.000Z' },
    ])
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
    vi.mocked(fetchAgentConversation).mockResolvedValue(detailWithMessages as any)

    const wrapper = await mountPage()

    expect(fetchAgentConversation).toHaveBeenCalledWith('conv-standalone-1')

    const bubbles = wrapper.findAll('[data-testid="agent-message"]')
    expect(bubbles).toHaveLength(2)
    expect(wrapper.text()).toContain('Hi')
    expect(wrapper.text()).toContain('Hello')
    expect(wrapper.text()).not.toContain('You are a tutor.')
    expect(wrapper.text()).not.toContain('tool-output')
    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="citation-chip"]').exists()).toBe(false)
  })

  it('renders empty state with no message list when conversation has no messages', async () => {
    const wrapper = await mountPage()

    expect(wrapper.find('[data-testid="agent-empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="agent-message"]')).toHaveLength(0)
  })
})

describe('Agent chat page SSE turn streaming', () => {
  it('appends user bubble immediately and grows assistant reply via text-delta events', async () => {
    emitEvents([
      { type: 'text-delta', textDelta: 'Service ' },
      { type: 'text-delta', text: 'Control Policies.' },
    ])

    const wrapper = await mountPage()
    await wrapper.find('[data-testid="agent-input"]').setValue('What is SCP?')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(streamTurnMock).toHaveBeenCalledWith(
      'conv-standalone-1',
      'What is SCP?',
      expect.any(Function),
    )
    const bubbles = wrapper.findAll('[data-testid="agent-message"]')
    expect(bubbles).toHaveLength(2)
    expect(wrapper.text()).toContain('What is SCP?')
    expect(wrapper.text()).toContain('Service Control Policies.')
  })

  it('shows streaming cursor while streaming, disables send, user bubble appears immediately', async () => {
    let resolveStream!: () => void
    const streamPending = new Promise<void>((resolve) => {
      resolveStream = resolve
    })
    streamTurnMock.mockImplementation(async () => streamPending)

    const wrapper = await mountPage()
    await wrapper.find('[data-testid="agent-input"]').setValue('Hello')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')

    expect(wrapper.text()).toContain('Hello')
    expect(wrapper.find('[data-testid="agent-streaming-cursor"]').exists()).toBe(true)
    expect(
      (wrapper.find('[data-testid="agent-send-button"]').element as HTMLButtonElement).disabled,
    ).toBe(true)

    resolveStream()
    await flushPromises()

    expect(wrapper.find('[data-testid="agent-streaming-cursor"]').exists()).toBe(false)
    expect(
      (wrapper.find('[data-testid="agent-send-button"]').element as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('does not call streamTurn when input is whitespace-only', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="agent-input"]').setValue('   ')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(streamTurnMock).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="agent-message"]')).toHaveLength(0)
  })

  it('clears the input after sending', async () => {
    const wrapper = await mountPage()
    const input = wrapper.find<HTMLInputElement>('[data-testid="agent-input"]')
    await input.setValue('Something to ask')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()
    expect(input.element.value).toBe('')
  })
})

describe('Agent chat empty state and suggestions', () => {
  it('renders the Study assistant heading, intro text, suggestions label, and 4 chips with exact artboard copy', async () => {
    const wrapper = await mountPage()

    const emptyState = wrapper.find('[data-testid="agent-empty-state"]')
    expect(emptyState.exists()).toBe(true)
    expect(wrapper.text()).toContain('Study assistant')
    expect(wrapper.text()).toContain(
      'Ask me anything — concepts, explanations, analogies. No exam corpus attached here; answers from general knowledge only.',
    )
    expect(wrapper.text()).toContain('Suggestions')

    const chips = wrapper.findAll('[data-testid="agent-suggestion"]')
    expect(chips).toHaveLength(4)
    expect(chips[0].text()).toBe("What's the difference between TCP and UDP?")
    expect(chips[1].text()).toBe('Explain eventual consistency in plain language')
    expect(chips[2].text()).toBe('How does TLS handshake work?')
    expect(chips[3].text()).toBe('When would I use a queue vs a topic?')
  })

  it('clicking a suggestion chip submits its text as the first turn and removes the empty state', async () => {
    emitEvents([{ type: 'text-delta', textDelta: 'TCP vs UDP answer' }])

    const wrapper = await mountPage()
    const chips = wrapper.findAll('[data-testid="agent-suggestion"]')
    await chips[0].trigger('click')
    await flushPromises()

    expect(streamTurnMock).toHaveBeenCalledWith(
      'conv-standalone-1',
      "What's the difference between TCP and UDP?",
      expect.any(Function),
    )
    expect(wrapper.find('[data-testid="agent-empty-state"]').exists()).toBe(false)
    const bubbles = wrapper.findAll('[data-testid="agent-message"]')
    expect(bubbles.length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain("What's the difference between TCP and UDP?")
  })
})

describe('Agent chat new-chat reset', () => {
  it('clicking new-chat-button clears messages, fires a second create call, and returns to empty state', async () => {
    emitEvents([{ type: 'text-delta', textDelta: 'Answer' }])

    const wrapper = await mountPage()
    await wrapper.find('[data-testid="agent-input"]').setValue('Hello')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="agent-message"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="agent-empty-state"]').exists()).toBe(false)

    streamTurnMock.mockResolvedValue(undefined)

    await wrapper.find('[data-testid="agent-new-chat-button"]').trigger('click')
    await flushPromises()

    expect(createStandaloneAgentConversation).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('[data-testid="agent-message"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="agent-empty-state"]').exists()).toBe(true)
  })
})

describe('Agent chat TTL chip and expiry banner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // "now" is 10 minutes after lastActivityAt ('2026-06-29T09:05:00.000Z')
    vi.setSystemTime(new Date('2026-06-29T09:15:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows chip with ~3h 50m remaining when lastActivityAt is 10 min ago', async () => {
    const wrapper = await mountPage()

    const chip = wrapper.find('[data-testid="agent-ttl-chip"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('3h 50m')
    expect(wrapper.find('[data-testid="agent-expiry-banner"]').exists()).toBe(false)
  })

  it('shows expiry banner when conversation is near expiry (5 min remaining)', async () => {
    // 3h 55min after lastActivityAt (09:05) → only 5 min left < 15 min threshold
    vi.setSystemTime(new Date('2026-06-29T13:00:00.000Z'))
    const wrapper = await mountPage()

    expect(wrapper.find('[data-testid="agent-expiry-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('5 minutes')
  })

  it('hides banner after send due to optimistic lastActivityAt reset', async () => {
    // Start near expiry
    vi.setSystemTime(new Date('2026-06-29T13:00:00.000Z'))
    emitEvents([{ type: 'text-delta', textDelta: 'Sure!' }])

    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="agent-expiry-banner"]').exists()).toBe(true)

    await wrapper.find('[data-testid="agent-input"]').setValue('Hello')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    // Optimistic reset sets lastActivityAt to now (13:00:00), remaining becomes ~4h
    expect(wrapper.find('[data-testid="agent-expiry-banner"]').exists()).toBe(false)
  })

  it('chip text jumps back to ~4h after send', async () => {
    // Start near expiry
    vi.setSystemTime(new Date('2026-06-29T13:00:00.000Z'))
    emitEvents([{ type: 'text-delta', textDelta: 'Reply' }])

    const wrapper = await mountPage()
    const chip = wrapper.find('[data-testid="agent-ttl-chip"]')
    // Before send: 5 min remaining
    expect(chip.text()).toContain('5m')

    await wrapper.find('[data-testid="agent-input"]').setValue('Question')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    // After send: lastActivityAt reset to now, remaining ~4h
    expect(chip.text()).toContain('4h')
  })
})

describe('Agent chat page error handling', () => {
  it('renders error from error SSE event on assistant message and re-enables send', async () => {
    emitEvents([
      { type: 'text-delta', textDelta: 'Partial answer' },
      { type: 'error', error: 'upstream model timeout' },
    ])

    const wrapper = await mountPage()
    await wrapper.find('[data-testid="agent-input"]').setValue('Explain this')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="agent-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('upstream model timeout')
    expect(
      (wrapper.find('[data-testid="agent-send-button"]').element as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('renders error for non-OK response (streamTurn emits synthetic error event)', async () => {
    emitEvents([{ type: 'error', error: 'Agent request failed (503)' }])

    const wrapper = await mountPage()
    await wrapper.find('[data-testid="agent-input"]').setValue('Try this')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="agent-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Agent request failed (503)')
    expect(
      (wrapper.find('[data-testid="agent-send-button"]').element as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('panel stays usable after error — next successful send works', async () => {
    emitEvents([{ type: 'error', error: 'timeout' }])

    const wrapper = await mountPage()
    await wrapper.find('[data-testid="agent-input"]').setValue('First')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="agent-error"]').exists()).toBe(true)

    emitEvents([{ type: 'text-delta', textDelta: 'Recovery answer.' }])
    await wrapper.find('[data-testid="agent-input"]').setValue('Second')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(streamTurnMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Recovery answer.')
  })
})
