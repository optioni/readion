import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import { fetchAgentConversation } from '~/composables/sessionViewApi'
import { useStandaloneAgentChat } from '~/composables/useStandaloneAgentChat'
import { clearUmamiRecorder, installUmamiRecorder } from '../support/umami-recorder'

const { streamTurnMock } = vi.hoisted(() => ({ streamTurnMock: vi.fn() }))

vi.mock('~/composables/agentChatApi', () => ({
  createStandaloneAgentConversation: vi.fn(),
}))
vi.mock('~/composables/sessionViewApi', () => ({
  fetchAgentConversation: vi.fn(),
}))
vi.mock('~/composables/useAgentTurnStream', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useAgentTurnStream')>()
  return { ...actual, useAgentTurnStream: () => ({ streamTurn: streamTurnMock }) }
})

// biome-ignore lint/suspicious/noExplicitAny: fixtures narrowed to the fields under assertion
const conversation = (id: string): any => ({
  data: { id, lastActivityAt: '2026-06-29T09:00:00.000Z' },
  relationships: { messages: { data: [] } },
})

function renderChat() {
  let api!: ReturnType<typeof useStandaloneAgentChat>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useStandaloneAgentChat()
        return () => null
      },
    }),
  )
  return { api, wrapper }
}

describe('useStandaloneAgentChat analytics', () => {
  let recorder: ReturnType<typeof installUmamiRecorder>

  beforeEach(() => {
    vi.clearAllMocks()
    recorder = installUmamiRecorder()
    vi.mocked(createStandaloneAgentConversation).mockResolvedValue(conversation('conv-1'))
    vi.mocked(fetchAgentConversation).mockResolvedValue(conversation('conv-1'))
    streamTurnMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    clearUmamiRecorder()
  })

  it('emits agent_chat_opened { standalone: true } when the conversation initializes', async () => {
    renderChat()
    await flushPromises()

    expect(recorder.track).toHaveBeenCalledWith('agent_chat_opened', { standalone: true })
  })

  it('emits agent_message_sent { inSession: false } for a non-empty message', async () => {
    const { api } = renderChat()
    await flushPromises()
    recorder.events.length = 0

    await api.send('hello there')

    expect(recorder.track).toHaveBeenCalledWith('agent_message_sent', { inSession: false })
  })

  it('does not emit for a whitespace-only message', async () => {
    const { api } = renderChat()
    await flushPromises()
    recorder.events.length = 0

    await api.send('   ')

    expect(recorder.events.map((e) => e.event)).not.toContain('agent_message_sent')
  })

  it('emits agent_new_chat when the user starts a new chat', async () => {
    const { api } = renderChat()
    await flushPromises()
    recorder.events.length = 0

    await api.newChat()

    expect(recorder.events.map((e) => e.event)).toContain('agent_new_chat')
  })
})
