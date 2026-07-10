import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MockExamNavPanel from '~/components/MockExamNavPanel.vue'

describe('MockExamNavPanel', () => {
  it('exposes the nav root and a square per question', () => {
    const wrapper = mount(MockExamNavPanel, {
      props: { mode: 'active', total: 65, currentIndex: 0, answeredIndices: [] },
    })

    expect(wrapper.find('[data-testid="exam-nav"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="exam-nav-square"]')).toHaveLength(65)
  })

  it('labels squares 1-based over their zero-based index', () => {
    const wrapper = mount(MockExamNavPanel, {
      props: { mode: 'active', total: 3, currentIndex: 0, answeredIndices: [] },
    })

    const squares = wrapper.findAll('[data-testid="exam-nav-square"]')
    expect(squares[0]!.text()).toBe('1')
    expect(squares[1]!.text()).toBe('2')
    expect(squares[2]!.text()).toBe('3')
  })

  describe('preparing mode', () => {
    it('shows an N / total ready progress indicator and a bar', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'preparing', total: 65, readyCount: 20 },
      })

      expect(wrapper.find('[data-testid="exam-prepare-progress"]').text()).toMatch(/20 \/ 65 ready/)
      expect(wrapper.find('[data-testid="exam-prepare-bar"]').exists()).toBe(true)
    })

    it('renders a square only for each streamed-in question', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'preparing', total: 65, readyCount: 20 },
      })

      expect(wrapper.findAll('[data-testid="exam-nav-square"]')).toHaveLength(20)
    })
  })

  describe('active mode', () => {
    it('reflects answered, current, and unanswered states', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: {
          mode: 'active',
          total: 65,
          currentIndex: 11,
          answeredIndices: Array.from({ length: 11 }, (_, i) => i),
        },
      })

      const squares = wrapper.findAll('[data-testid="exam-nav-square"]')
      expect(squares[0]!.attributes('data-state')).toBe('answered')
      expect(squares[10]!.attributes('data-state')).toBe('answered')
      expect(squares[11]!.attributes('data-state')).toBe('current')
      expect(squares[12]!.attributes('data-state')).toBe('unanswered')
    })

    it('summarises the answered count, a legend, and a submit button', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: {
          mode: 'active',
          total: 65,
          currentIndex: 11,
          answeredIndices: Array.from({ length: 11 }, (_, i) => i),
        },
      })

      expect(wrapper.find('[data-testid="exam-answered-count"]').text()).toMatch(
        /11 of 65 answered/,
      )
      expect(wrapper.find('[data-testid="exam-nav-legend"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="exam-submit-button"]').exists()).toBe(true)
    })

    it('shows an Answered and a Flagged legend swatch, not Current', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'active', total: 65, currentIndex: 0, answeredIndices: [] },
      })

      const legend = wrapper.find('[data-testid="exam-nav-legend"]')
      expect(legend.text()).toContain('Answered')
      expect(legend.text()).toContain('Flagged')
      expect(legend.text()).not.toContain('Current')
    })

    it('renders a flagged question in the Flagged state independently of the current square', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: {
          mode: 'active',
          total: 5,
          currentIndex: 2,
          answeredIndices: [],
          flaggedIndices: [4],
        },
      })

      const squares = wrapper.findAll('[data-testid="exam-nav-square"]')
      expect(squares[4]!.attributes('data-state')).toBe('flagged')
      expect(squares[2]!.attributes('data-state')).toBe('current')
    })

    it('emits the zero-based index when a square is clicked', async () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'active', total: 65, currentIndex: 0, answeredIndices: [] },
      })

      await wrapper.findAll('[data-testid="exam-nav-square"]')[30]!.trigger('click')

      expect(wrapper.emitted('navigate')).toEqual([[30]])
    })

    it('emits submit when the submit button is clicked', async () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'active', total: 65, currentIndex: 0, answeredIndices: [] },
      })

      await wrapper.find('[data-testid="exam-submit-button"]').trigger('click')

      expect(wrapper.emitted('submit')).toHaveLength(1)
    })
  })

  describe('review mode', () => {
    const outcomes: ('correct' | 'incorrect' | 'skipped')[] = [
      'correct',
      'incorrect',
      'skipped',
      'correct',
    ]

    it('recolours squares by per-question outcome', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'review', total: 4, outcomes },
      })

      const squares = wrapper.findAll('[data-testid="exam-nav-square"]')
      expect(squares.map((s) => s.attributes('data-state'))).toEqual([
        'correct',
        'incorrect',
        'skipped',
        'correct',
      ])
    })

    it('summarises correct, incorrect, and skipped counts', () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'review', total: 4, outcomes },
      })

      const text = wrapper.find('[data-testid="exam-review-counts"]').text()
      expect(text).toMatch(/2 correct/)
      expect(text).toMatch(/1 incorrect/)
      expect(text).toMatch(/1 skipped/)
    })

    it('emits the zero-based index when a review square is clicked', async () => {
      const wrapper = mount(MockExamNavPanel, {
        props: { mode: 'review', total: 4, outcomes },
      })

      await wrapper.findAll('[data-testid="exam-nav-square"]')[1]!.trigger('click')

      expect(wrapper.emitted('navigate')).toEqual([[1]])
    })
  })
})
