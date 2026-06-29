import type { ExtractedField } from '@readion/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CertFieldRow from '~/components/admin/CertFieldRow.vue'

const CITATION = { url: 'https://example.com/g', passage: 'cited passage' }

function mountRow(props: {
  fieldKey: string
  field: ExtractedField<unknown>
  domains?: { name: string; weight: number }[] | null
  numericValue?: number | null
  review?: 'confirmed' | 'flagged'
}) {
  return mount(CertFieldRow, {
    props: {
      label: 'Label',
      domains: null,
      numericValue: null,
      review: undefined,
      // biome-ignore lint/suspicious/noExplicitAny: narrowing the prop union in tests
      ...(props as any),
    },
  })
}

describe('CertFieldRow', () => {
  it('renders a grounded numeric field with its value, citation and edit input', () => {
    const wrapper = mountRow({
      fieldKey: 'passingScore',
      field: { value: 67, citation: CITATION },
      numericValue: 67,
    })

    expect(wrapper.find('[data-testid="field-value"]').text()).toBe('67')
    expect(wrapper.find('[data-testid="field-citation"]').text()).toContain('cited passage')
    expect(wrapper.find('[data-testid="field-value-input"]').exists()).toBe(true)
  })

  it('emits the parsed number when edited and null when cleared', async () => {
    const wrapper = mountRow({
      fieldKey: 'passingScore',
      field: { value: 67, citation: CITATION },
      numericValue: 67,
    })

    await wrapper.find('[data-testid="field-value-input"]').setValue('72')
    await wrapper.find('[data-testid="field-value-input"]').setValue('')

    expect(wrapper.emitted('edit')).toEqual([[72], [null]])
  })

  it('emits confirm and flag from the review buttons', async () => {
    const wrapper = mountRow({
      fieldKey: 'passingScore',
      field: { value: 67, citation: CITATION },
      numericValue: 67,
    })

    await wrapper.find('[data-testid="field-confirm-btn"]').trigger('click')
    await wrapper.find('[data-testid="field-flag-btn"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('flag')).toHaveLength(1)
  })

  it('renders a grounded domains field as a weighted list without a numeric input', () => {
    const wrapper = mountRow({
      fieldKey: 'domains',
      field: { value: [{ name: 'Cloud', weight: 100 }], citation: CITATION },
      domains: [{ name: 'Cloud', weight: 100 }],
    })

    expect(wrapper.text()).toContain('Cloud — 100%')
    expect(wrapper.find('[data-testid="field-value-input"]').exists()).toBe(false)
  })

  it('marks an unverified numeric field confirm-manually with an entry input', () => {
    const wrapper = mountRow({
      fieldKey: 'questionCount',
      field: { unverified: true },
    })

    expect(wrapper.text()).toMatch(/confirm manually/i)
    expect(wrapper.find('[data-testid="field-value-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="field-citation"]').exists()).toBe(false)
  })

  it('marks an unverified domains field confirm-manually without a numeric input', () => {
    const wrapper = mountRow({
      fieldKey: 'domains',
      field: { unverified: true },
    })

    expect(wrapper.text()).toMatch(/confirm manually/i)
    expect(wrapper.find('[data-testid="field-value-input"]').exists()).toBe(false)
  })

  it('reflects the review flag in the data-review attribute', () => {
    const wrapper = mountRow({
      fieldKey: 'passingScore',
      field: { value: 67, citation: CITATION },
      numericValue: 67,
      review: 'flagged',
    })

    expect(
      wrapper.find('[data-testid="extraction-field-passingScore"]').attributes('data-review'),
    ).toBe('flagged')
  })
})
