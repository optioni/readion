import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminPagination from '~/components/admin/AdminPagination.vue'

function mountPagination(props: { page: number; limit: number; total: number; testid: string }) {
  return mount(AdminPagination, { props })
}

describe('AdminPagination', () => {
  it('does not render when the total fits within a single page', () => {
    const wrapper = mountPagination({
      page: 1,
      limit: 20,
      total: 3,
      testid: 'admin-users-pagination',
    })

    expect(wrapper.find('[data-testid="admin-users-pagination"]').exists()).toBe(false)
  })

  it('renders under the given testid when the total spans more than one page', () => {
    const wrapper = mountPagination({
      page: 1,
      limit: 20,
      total: 23,
      testid: 'admin-users-pagination',
    })

    expect(wrapper.find('[data-testid="admin-users-pagination"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('2')
  })

  it('disables previous on the first page and emits update:page with the next page on next click', async () => {
    const wrapper = mountPagination({
      page: 1,
      limit: 20,
      total: 23,
      testid: 'admin-users-pagination',
    })

    const prev = wrapper.find('[data-testid="admin-users-pagination-prev"]')
    expect((prev.element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('[data-testid="admin-users-pagination-next"]').trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[2]])
  })

  it('disables next on the last page and emits update:page with the previous page on prev click', async () => {
    const wrapper = mountPagination({
      page: 2,
      limit: 20,
      total: 23,
      testid: 'admin-users-pagination',
    })

    const next = wrapper.find('[data-testid="admin-users-pagination-next"]')
    expect((next.element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('[data-testid="admin-users-pagination-prev"]').trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[1]])
  })
})
