import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CertTabs from '~/components/CertTabs.vue'

// navigateTo is a Nuxt global
vi.stubGlobal('navigateTo', vi.fn())

// Stub AddCertificationModal to avoid its query deps
vi.mock('~/components/AddCertificationModal.vue', () => ({
  default: { template: '<div data-testid="add-cert-modal-stub" />' },
}))

export interface SwitcherEntry {
  enrollmentId: string
  certName: string
}

const ENROLLMENTS: SwitcherEntry[] = [
  { enrollmentId: 'enr-aws', certName: 'AWS Certified Solutions Architect — Associate' },
  { enrollmentId: 'enr-azure', certName: 'Azure Administrator Associate' },
]

function mountTabs(activeEnrollmentId = 'enr-aws') {
  return mount(CertTabs, {
    props: {
      enrollments: ENROLLMENTS,
      activeEnrollmentId,
    },
    global: {
      stubs: {
        AddCertificationModal: { template: '<div data-testid="add-cert-modal-stub" />' },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CertTabs', () => {
  it('renders the cert-switcher testid', () => {
    const wrapper = mountTabs()
    expect(wrapper.find('[data-testid="cert-switcher"]').exists()).toBe(true)
  })

  it('renders an entry for each enrollment with its cert name', () => {
    const wrapper = mountTabs()
    const switcher = wrapper.find('[data-testid="cert-switcher"]')
    expect(switcher.text()).toContain('AWS Certified Solutions Architect — Associate')
    expect(switcher.text()).toContain('Azure Administrator Associate')
  })

  it('navigates to the clicked enrollment progress route on click', async () => {
    const wrapper = mountTabs('enr-aws')
    const azureButton = wrapper
      .find('[data-testid="cert-switcher"]')
      .findAll('button')
      .find((b) => b.text().includes('Azure'))
    expect(azureButton).toBeTruthy()
    await azureButton!.trigger('click')
    expect(vi.mocked(navigateTo)).toHaveBeenCalledWith('/user-certifications/enr-azure/progress')
  })

  it('marks the active enrollment visually', () => {
    const wrapper = mountTabs('enr-aws')
    const switcher = wrapper.find('[data-testid="cert-switcher"]')
    const activeButton = switcher.findAll('button').find((b) => b.text().includes('AWS'))
    expect(activeButton?.attributes('aria-current')).toBe('page')
  })

  it('includes a "+ Add" button to open AddCertificationModal', () => {
    const wrapper = mountTabs()
    const addBtn = wrapper.find('[data-testid="cert-switcher-add"]')
    expect(addBtn.exists()).toBe(true)
  })
})
