import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AgentBubble from '~/components/AgentBubble.vue'
import type { AgentPanelMessage } from '~/composables/agentMessages'

function userMessage(content: string): AgentPanelMessage {
  return { role: 'user', content, toolResults: [], error: null }
}

function assistantMessage(content: string): AgentPanelMessage {
  return { role: 'assistant', content, toolResults: [], error: null }
}

describe('AgentBubble color roles', () => {
  it('renders the user bubble with surface background and secondary text, not primary', () => {
    const wrapper = mount(AgentBubble, { props: { message: userMessage('Hello there') } })

    const bubble = wrapper.find('[data-testid="agent-message-bubble"]')
    expect(bubble.classes()).toContain('bg-readion-background-surface')
    expect(bubble.classes()).toContain('text-readion-text-secondary')
    expect(bubble.classes()).not.toContain('bg-readion-primary')
    expect(bubble.classes()).not.toContain('text-white')
  })

  it('renders the assistant bubble with primary background and white text, not surface', () => {
    const wrapper = mount(AgentBubble, {
      props: { message: assistantMessage('Sure, here it is.') },
    })

    const bubble = wrapper.find('[data-testid="agent-message-bubble"]')
    expect(bubble.classes()).toContain('bg-readion-primary')
    expect(bubble.classes()).toContain('text-white')
    expect(bubble.classes()).not.toContain('bg-readion-background-surface')
  })
})

describe('AgentBubble assistant avatar', () => {
  it('renders a per-message sparkle avatar for assistant bubbles', () => {
    const wrapper = mount(AgentBubble, { props: { message: assistantMessage('Answer.') } })
    expect(wrapper.find('[data-testid="agent-message-avatar"]').exists()).toBe(true)
  })

  it('does not render an avatar for user bubbles', () => {
    const wrapper = mount(AgentBubble, { props: { message: userMessage('Question.') } })
    expect(wrapper.find('[data-testid="agent-message-avatar"]').exists()).toBe(false)
  })
})

describe('AgentBubble paragraph rendering', () => {
  it('renders a multi-paragraph assistant turn as discrete <p> elements', () => {
    const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    const wrapper = mount(AgentBubble, { props: { message: assistantMessage(content) } })

    const paragraphs = wrapper.findAll('[data-testid="agent-message-bubble"] p')
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0]?.text()).toBe('First paragraph.')
    expect(paragraphs[1]?.text()).toBe('Second paragraph.')
    expect(paragraphs[2]?.text()).toBe('Third paragraph.')
  })
})

describe('AgentBubble inline streaming cursor', () => {
  it('renders the cursor inline at the end of the last paragraph while streaming', () => {
    const wrapper = mount(AgentBubble, {
      props: { message: assistantMessage('First.\n\nSecond.'), streaming: true },
    })

    const paragraphs = wrapper.findAll('[data-testid="agent-message-bubble"] p')
    expect(paragraphs).toHaveLength(2)

    const cursor = wrapper.find('[data-testid="agent-streaming-cursor"]')
    expect(cursor.exists()).toBe(true)
    // Inline within the LAST paragraph, not a sibling block after it.
    expect(paragraphs[1]?.find('[data-testid="agent-streaming-cursor"]').exists()).toBe(true)
    expect(paragraphs[0]?.find('[data-testid="agent-streaming-cursor"]').exists()).toBe(false)
  })

  it('renders the cursor even before any text has streamed in yet', () => {
    const wrapper = mount(AgentBubble, {
      props: { message: assistantMessage(''), streaming: true },
    })
    expect(wrapper.find('[data-testid="agent-streaming-cursor"]').exists()).toBe(true)
  })

  it('does not render the cursor once streaming has finished', () => {
    const wrapper = mount(AgentBubble, {
      props: { message: assistantMessage('Done.'), streaming: false },
    })
    expect(wrapper.find('[data-testid="agent-streaming-cursor"]').exists()).toBe(false)
  })

  it('never renders the cursor on a user bubble', () => {
    const wrapper = mount(AgentBubble, {
      props: { message: userMessage('Question.'), streaming: true },
    })
    expect(wrapper.find('[data-testid="agent-streaming-cursor"]').exists()).toBe(false)
  })
})
