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

describe('useStandaloneAgentChat', () => {
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

  it('exposes explicit initialization failure and retries exactly once', async () => {
    vi.mocked(createStandaloneAgentConversation).mockRejectedValueOnce(new Error('unavailable'))
    const { api } = renderChat()

    expect(api.isInitializing.value).toBe(true)
    await flushPromises()
    expect(api.isInitialized.value).toBe(false)
    expect(api.initializationError.value).toContain("Couldn't start the conversation")

    const firstRetry = api.retryInitialization()
    const duplicateRetry = api.retryInitialization()
    await Promise.all([firstRetry, duplicateRetry])

    expect(createStandaloneAgentConversation).toHaveBeenCalledTimes(2)
    expect(api.isInitialized.value).toBe(true)
    expect(api.initializationError.value).toBeNull()
  })

  it('preserves hydrated messages while a background refresh is pending', async () => {
    const { api } = renderChat()
    await flushPromises()
    api.messages.value = [{ role: 'user', content: 'Keep me', toolResults: [], error: null }]

    let finishRefresh = () => {}
    vi.mocked(fetchAgentConversation).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = () => resolve(conversation('conv-1'))
        }),
    )
    const refresh = api.refreshConversation()

    expect(api.isRefreshing.value).toBe(true)
    expect(api.messages.value[0]?.content).toBe('Keep me')
    finishRefresh()
    await refresh
    expect(api.isRefreshing.value).toBe(false)
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

  it('resets lastActivityAt only after a successful turn completes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T13:00:00.000Z'))
    let finishTurn = () => {}
    streamTurnMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishTurn = resolve
        }),
    )
    const { api } = renderChat()
    await flushPromises()
    const staleActivity = api.lastActivityAt.value

    const pending = api.send('hello')
    expect(api.lastActivityAt.value).toBe(staleActivity)
    finishTurn()
    await pending
    expect(api.lastActivityAt.value).toBe('2026-06-29T13:00:00.000Z')
    vi.useRealTimers()
  })

  it('emits agent_new_chat when the user starts a new chat', async () => {
    const { api } = renderChat()
    await flushPromises()
    recorder.events.length = 0

    await api.newChat()

    expect(recorder.events.map((e) => e.event)).toContain('agent_new_chat')
  })
})
