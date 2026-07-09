import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuickStartButtons from '~/components/QuickStartButtons.vue'

const mountButtons = (variant: 'hero' | 'standard' = 'standard') =>
  mount(QuickStartButtons, {
    props: {
      variant,
      isStartingSession: false,
      isStartingMockExam: false,
    },
  })

describe('QuickStartButtons — sentence-case copy', () => {
  it('reads "Mock exam" in sentence case, not "Mock Exam"', () => {
    const wrapper = mountButtons()
    expect(wrapper.find('[data-testid="mock-exam-btn"]').text()).toBe('Mock exam')
  })
})
