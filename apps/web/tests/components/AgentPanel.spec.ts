import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentPanel from '~/components/AgentPanel.vue'
import {
  createSessionAgentConversation,
  fetchAgentConversation,
} from '~/composables/sessionViewApi'
import type { AgentStreamEvent } from '~/composables/useAgentTurnStream'
import { clearUmamiRecorder, installUmamiRecorder } from '../support/umami-recorder'

const { streamTurnMock } = vi.hoisted(() => ({ streamTurnMock: vi.fn() }))

vi.mock('~/composables/sessionViewApi', () => ({
  createSessionAgentConversation: vi.fn(),
  fetchAgentConversation: vi.fn(),
}))

vi.mock('~/composables/useAgentTurnStream', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useAgentTurnStream')>()
  return {
    ...actual,
    useAgentTurnStream: () => ({ streamTurn: streamTurnMock }),
  }
})

function conversationDetail(messages: unknown[] = []) {
  return {
    data: {
      id: 'conv-1',
      mode: 'in_session',
      studySessionId: 'sess-1',
      certificationId: 'cert-1',
      lastActivityAt: '2026-06-28T09:05:00.000Z',
      createdAt: '2026-06-28T09:05:00.000Z',
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
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(createSessionAgentConversation).mockResolvedValue(conversationDetail() as any)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchAgentConversation).mockResolvedValue(conversationDetail() as any)
  streamTurnMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

async function mountPanel() {
  const wrapper = mount(AgentPanel, { props: { sessionId: 'sess-1' } })
  await flushPromises()
  return wrapper
}

describe('AgentPanel lifecycle', () => {
  it('ensures the in-session conversation and hydrates prior messages on mount', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
    vi.mocked(fetchAgentConversation).mockResolvedValue(
      conversationDetail([
        { role: 'user', content: 'Hi there', createdAt: '2026-06-28T09:05:00.000Z' },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, ready to study?' }],
          createdAt: '2026-06-28T09:05:01.000Z',
        },
        { role: 'system', content: 'You are a tutor.', createdAt: '2026-06-28T09:05:02.000Z' },
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
      ]) as any,
    )

    const wrapper = await mountPanel()

    expect(createSessionAgentConversation).toHaveBeenCalledWith('sess-1')
    expect(fetchAgentConversation).toHaveBeenCalledWith('conv-1')

    const bubbles = wrapper.findAll('[data-testid="agent-message"]')
    expect(bubbles).toHaveLength(2)
    expect(wrapper.text()).toContain('Hi there')
    expect(wrapper.text()).toContain('Hello, ready to study?')
    expect(wrapper.text()).not.toContain('You are a tutor.')
  })

  it('renders the panel root with the input and send controls', async () => {
    const wrapper = await mountPanel()
    expect(wrapper.find('[data-testid="agent-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="agent-send-button"]').exists()).toBe(true)
  })
})

describe('AgentPanel sending a turn', () => {
  it('appends the user message, streams the assistant reply, and renders a tool card', async () => {
    emitEvents([
      { type: 'text-delta', textDelta: 'Service Control Policies ' },
      { type: 'text-delta', text: 'are guardrails.' },
      {
        type: 'tool-result',
        toolName: 'explainAnswer',
        output: {
          correctOption: 'b',
          explanation: 'SCPs cap permissions.',
          citations: ['AWS Organizations User Guide'],
        },
      },
    ])

    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="agent-input"]').setValue('Why an SCP?')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(streamTurnMock).toHaveBeenCalledTimes(1)
    expect(streamTurnMock.mock.calls[0]?.[0]).toBe('conv-1')
    expect(streamTurnMock.mock.calls[0]?.[1]).toBe('Why an SCP?')

    expect(wrapper.text()).toContain('Why an SCP?')
    expect(wrapper.text()).toContain('Service Control Policies are guardrails.')
    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(true)
  })

  it('clears the input after sending', async () => {
    const wrapper = await mountPanel()
    const input = wrapper.find<HTMLInputElement>('[data-testid="agent-input"]')
    await input.setValue('My progress here')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(input.element.value).toBe('')
  })

  it('does not send when the input is empty', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()
    expect(streamTurnMock).not.toHaveBeenCalled()
  })
})

describe('AgentPanel error handling', () => {
  it('surfaces a stream error inline and keeps the panel usable for the next message', async () => {
    emitEvents([
      { type: 'text-delta', textDelta: 'Let me look that up' },
      { type: 'error', error: 'upstream model timeout' },
    ])

    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="agent-input"]').setValue('Explain this')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="agent-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('upstream model timeout')

    // The panel stays usable: a second send streams successfully.
    emitEvents([{ type: 'text-delta', textDelta: 'Second answer.' }])
    await wrapper.find('[data-testid="agent-input"]').setValue('Try again')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(streamTurnMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Second answer.')
  })
})

describe('AgentPanel analytics', () => {
  let recorder: ReturnType<typeof installUmamiRecorder>

  beforeEach(() => {
    recorder = installUmamiRecorder()
  })

  afterEach(() => {
    clearUmamiRecorder()
  })

  it('emits agent_chat_opened { standalone: false } when the in-session conversation opens', async () => {
    await mountPanel()

    expect(recorder.track).toHaveBeenCalledWith('agent_chat_opened', { standalone: false })
  })

  it('emits agent_message_sent { inSession: true } for a non-empty message', async () => {
    const wrapper = await mountPanel()
    recorder.events.length = 0

    await wrapper.find('[data-testid="agent-input"]').setValue('Why an SCP?')
    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(recorder.track).toHaveBeenCalledWith('agent_message_sent', { inSession: true })
  })

  it('does not emit for an empty message', async () => {
    const wrapper = await mountPanel()
    recorder.events.length = 0

    await wrapper.find('[data-testid="agent-send-button"]').trigger('click')
    await flushPromises()

    expect(recorder.events.map((e) => e.event)).not.toContain('agent_message_sent')
  })
})
