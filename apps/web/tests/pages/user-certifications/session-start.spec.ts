import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SessionStartPage from '~/pages/user-certifications/[id]/session/start.vue'

vi.stubGlobal('useRoute', () => ({ params: { id: 'enr-1' } }))
vi.stubGlobal('definePageMeta', vi.fn())

function mountPage() {
  return mount(SessionStartPage, {
    global: {
      stubs: {
        SessionStartQuickStart: {
          template:
            '<button data-testid="customise-link" @click="$emit(\'customise\')">quick</button>',
        },
        SessionStartCustomConfig: {
          template:
            '<button data-testid="use-defaults-link" @click="$emit(\'use-defaults\')">custom</button>',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Session start page', () => {
  it('exposes the page container and starts in quick-start mode', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="session-start-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="customise-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="use-defaults-link"]').exists()).toBe(false)
  })

  it('switches to custom config and back', async () => {
    const wrapper = mountPage()

    await wrapper.find('[data-testid="customise-link"]').trigger('click')
    expect(wrapper.find('[data-testid="use-defaults-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="customise-link"]').exists()).toBe(false)

    await wrapper.find('[data-testid="use-defaults-link"]').trigger('click')
    expect(wrapper.find('[data-testid="customise-link"]').exists()).toBe(true)
  })
})
