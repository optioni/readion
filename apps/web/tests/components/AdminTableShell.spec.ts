import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminTableShell from '~/components/admin/AdminTableShell.vue'

describe('AdminTableShell', () => {
  it('wraps its slot content in the surface-card shell', () => {
    const wrapper = mount(AdminTableShell, {
      slots: { default: '<table><tbody><tr><td>row</td></tr></tbody></table>' },
    })

    const shell = wrapper.find('[data-testid="admin-table-shell"]')
    expect(shell.exists()).toBe(true)
    expect(shell.find('table').exists()).toBe(true)
    expect(shell.text()).toContain('row')
  })
})
