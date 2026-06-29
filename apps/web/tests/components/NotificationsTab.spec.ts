import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import NotificationsTab from '~/components/NotificationsTab.vue'
import { emailControllerUnsubscribe } from '~~/src/api/email/email'
import { usersControllerGetMe, usersControllerUpdateMe } from '~~/src/api/users/users'

vi.mock('~~/src/api/users/users')
vi.mock('~~/src/api/email/email')

describe('NotificationsTab (descoped)', () => {
  it('surfaces the weekly-digest opt-out informatively', () => {
    const wrapper = mount(NotificationsTab)

    const info = wrapper.find('[data-testid="digest-opt-out-info"]')
    expect(info.exists()).toBe(true)

    const copy = info.text().toLowerCase()
    expect(copy).toContain('weekly')
    expect(copy).toContain('digest')
    expect(copy).toContain('unsubscribe')
    expect(copy).toContain('email')
  })

  it('renders no toggles for the unbacked notification preferences', () => {
    const wrapper = mount(NotificationsTab)

    expect(wrapper.find('[data-testid="notif-toggle-review-reminders"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notif-toggle-streak-alerts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notif-toggle-exam-countdown"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notif-toggle-in-app"]').exists()).toBe(false)
  })

  it('renders no toggle, switch, or checkbox controls at all', () => {
    const wrapper = mount(NotificationsTab)

    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(0)
    expect(wrapper.findAll('input')).toHaveLength(0)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('issues no request reading or writing digestOptOut and never unsubscribes from the page', () => {
    mount(NotificationsTab)

    expect(usersControllerGetMe).not.toHaveBeenCalled()
    expect(usersControllerUpdateMe).not.toHaveBeenCalled()
    expect(emailControllerUnsubscribe).not.toHaveBeenCalled()
  })
})
