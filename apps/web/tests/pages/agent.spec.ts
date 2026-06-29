import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import AgentPage from '~/pages/agent.vue'

vi.mock('~/composables/agentChatApi', () => ({
  createStandaloneAgentConversation: vi.fn(),
}))

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

beforeEach(() => {
  vi.clearAllMocks()
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(createStandaloneAgentConversation).mockResolvedValue(
    standaloneConversationDetail() as any,
  )
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
