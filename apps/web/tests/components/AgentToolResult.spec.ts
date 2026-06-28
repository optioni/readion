import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AgentToolResult from '~/components/agent/AgentToolResult.vue'

function mountResult(toolName: string, output: unknown, jobStatus: string | null = null) {
  return mount(AgentToolResult, {
    props: { part: { toolName, output }, jobStatus },
  })
}

describe('AgentToolResult dispatch', () => {
  it('renders the progress card with per-domain bars and a readiness chip', () => {
    const wrapper = mountResult('getUserProgress', {
      tool: 'getUserProgress',
      readiness: { calibrated: true, score: 0.72 },
      domains: [
        { domain: 'Secure Architectures', score: 0.41, accuracy: 0.44, meanConfidence: 0.6, responseCount: 18 },
      ],
    })

    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Secure Architectures')
    expect(wrapper.find('[data-testid="readiness-chip"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="progress-domain-bar"]')).toHaveLength(1)
  })

  it('renders the session-history card with domain accuracy entries', () => {
    const wrapper = mountResult('getSessionHistory', {
      tool: 'getSessionHistory',
      sessions: [
        {
          sessionId: 's1',
          kind: 'study',
          status: 'completed',
          endedAt: '2026-06-20T00:00:00.000Z',
          domains: [{ domain: 'Resilient Architectures', accuracy: 0.7 }],
        },
      ],
      mockExams: [],
      domainTrends: [],
    })

    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Resilient Architectures')
    expect(wrapper.text()).toContain('70%')
  })

  it('renders the explanation card with the correct answer highlighted and a citation chip', () => {
    const wrapper = mountResult('explainAnswer', {
      tool: 'explainAnswer',
      correctOption: 'b',
      explanation: 'SCPs **cap** the permissions available to accounts.',
      citations: ['AWS Organizations User Guide'],
    })

    const card = wrapper.find('[data-testid="tool-result-card"]')
    expect(card.exists()).toBe(true)
    expect(wrapper.find('[data-testid="explanation-correct-answer"]').text()).toContain('B')
    expect(wrapper.html()).toContain('<strong>cap</strong>')
    expect(wrapper.find('[data-testid="citation-chip"]').exists()).toBe(true)
  })

  it('renders the explanation card from the backend ChunkCitation shape', () => {
    const wrapper = mountResult('explainAnswer', {
      tool: 'explainAnswer',
      explanation: 'Guardrails only.',
      supportingSpans: ['span'],
      citations: [{ chunkId: 'c1', sourceUrl: 'https://docs', primaryDomain: 'Security' }],
    })

    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="citation-chip"]').text()).toContain('Security')
  })

  it('renders the exam-strategy tip card', () => {
    const wrapper = mountResult('examStrategy', {
      tool: 'examStrategy',
      domain: 'Secure Architectures',
      questionType: null,
      advice: 'Eliminate distractors first.',
    })

    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Eliminate distractors first.')
    expect(wrapper.text()).toContain('Secure Architectures')
  })

  it('renders fetchMoreMaterial fast path content inline', () => {
    const wrapper = mountResult('fetchMoreMaterial', {
      tool: 'fetchMoreMaterial',
      status: 'inline',
      content: 'Expanded **coverage** of SCP edge cases.',
    })

    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(true)
    expect(wrapper.html()).toContain('<strong>coverage</strong>')
    expect(wrapper.find('[data-testid="material-loading"]').exists()).toBe(false)
  })

  it('shows the enqueued/loading state for the slow path then the ready chip on completion', async () => {
    const wrapper = mountResult(
      'fetchMoreMaterial',
      { tool: 'fetchMoreMaterial', status: 'enqueued', jobId: 'job-1' },
      null,
    )

    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="material-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="material-enqueued-chip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="material-ready-chip"]').exists()).toBe(false)

    await wrapper.setProps({
      part: { toolName: 'fetchMoreMaterial', output: { tool: 'fetchMoreMaterial', status: 'enqueued', jobId: 'job-1' } },
      jobStatus: 'completed',
    })

    expect(wrapper.find('[data-testid="material-loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="material-ready-chip"]').exists()).toBe(true)
  })

  it('renders nothing for semanticSearch (internal lookup only)', () => {
    const wrapper = mountResult('semanticSearch', {
      tool: 'semanticSearch',
      internal: true,
      chunks: [{ id: 'c1', text: 'x', similarity: 0.9, sourceUrl: 'u', primaryDomain: 'd' }],
    })

    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(false)
    expect(wrapper.html().trim()).toBe('<!--v-if-->')
  })

  it('renders nothing for an unknown tool', () => {
    const wrapper = mountResult('mysteryTool', { foo: 'bar' })
    expect(wrapper.find('[data-testid="tool-result-card"]').exists()).toBe(false)
  })
})
