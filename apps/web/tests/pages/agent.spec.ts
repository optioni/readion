import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStandaloneAgentConversation } from '~/composables/agentChatApi'
import { fetchAgentConversation } from '~/composables/sessionViewApi'
import AgentPage from '~/pages/agent.vue'

vi.mock('~/composables/agentChatApi', () => ({
  createStandaloneAgentConversation: vi.fn(),
}))

vi.mock('~/composables/sessionViewApi', () => ({
  fetchAgentConversation: vi.fn(),
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
  const createMock = vi.mocked(createStandaloneAgentConversation)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  createMock.mockResolvedValue(standaloneConversationDetail() as any)
  // biome-ignore lint/suspicious/noExplicitAny: generated envelope narrowed in tests
  vi.mocked(fetchAgentConversation).mockResolvedValue(standaloneConversationDetail() as any)
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
