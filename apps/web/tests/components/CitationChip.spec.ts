import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CitationChip from '~/components/CitationChip.vue'

describe('CitationChip', () => {
  it('renders the provided label and exposes the citation-chip testid', () => {
    const wrapper = mount(CitationChip, { props: { label: 'chunk-scp-001' } })

    const chip = wrapper.find('[data-testid="citation-chip"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('chunk-scp-001')
  })
})
