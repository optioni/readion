import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AddCertificationModal from '~/components/AddCertificationModal.vue'
import { dashboardQueryKeys } from '~/composables/dashboardQueryKeys'
import { certificationsControllerList } from '~~/src/api/certifications/certifications'
import {
  userCertificationsControllerEnroll,
  userCertificationsControllerList,
} from '~~/src/api/user-certifications/user-certifications'

vi.mock('~~/src/api/certifications/certifications')
vi.mock('~~/src/api/user-certifications/user-certifications')

const certification = (overrides: { id: string; name: string; provider?: string }) => ({
  id: overrides.id,
  name: overrides.name,
  provider: overrides.provider ?? 'AWS',
  code: 'SAA-C03',
  domains: [],
  questionCount: 65,
  passingScore: 720,
  timeLimitMinutes: 130,
  state: 'ready',
})

const enrollment = (certificationId: string) => ({
  id: `enr-${certificationId}`,
  certificationId,
  status: 'active' as const,
  enrolledAt: '2026-06-01T00:00:00.000Z',
  sessionDefaults: {},
  readinessScore: 50,
})

const okEnvelope = <T>(rows: T[]) => ({
  data: { data: rows, meta: { total: rows.length, page: 1, limit: 20 } },
  status: 200 as const,
  headers: new Headers(),
})

function stubData(options: {
  certifications: ReturnType<typeof certification>[]
  enrollments: ReturnType<typeof enrollment>[]
}) {
  vi.mocked(certificationsControllerList).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    okEnvelope(options.certifications) as any,
  )
  vi.mocked(userCertificationsControllerList).mockResolvedValue(
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
    okEnvelope(options.enrollments) as any,
  )
}

function mountModal(open = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(AddCertificationModal, {
    props: { open },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient, invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('AddCertificationModal options', () => {
  it('shows loading synchronously while both lists are unresolved', () => {
    vi.mocked(certificationsControllerList).mockReturnValue(new Promise(() => {}))
    vi.mocked(userCertificationsControllerList).mockReturnValue(new Promise(() => {}))

    const { wrapper } = mountModal()

    expect(wrapper.find('[data-testid="add-cert-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="add-cert-empty-options"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-cert-option"]').exists()).toBe(false)
  })

  it('keeps loading until both certification and enrollment lists resolve', async () => {
    let resolveCertifications: (
      value: Awaited<ReturnType<typeof certificationsControllerList>>,
    ) => void = () => {}
    let resolveEnrollments: (
      value: Awaited<ReturnType<typeof userCertificationsControllerList>>,
    ) => void = () => {}
    vi.mocked(certificationsControllerList).mockReturnValue(
      new Promise((resolve) => {
        resolveCertifications = resolve
      }),
    )
    vi.mocked(userCertificationsControllerList).mockReturnValue(
      new Promise((resolve) => {
        resolveEnrollments = resolve
      }),
    )

    const { wrapper } = mountModal()
    resolveCertifications(
      okEnvelope([certification({ id: 'cert-1', name: 'AWS SA' })]) as Awaited<
        ReturnType<typeof certificationsControllerList>
      >,
    )
    await flushPromises()

    expect(wrapper.find('[data-testid="add-cert-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="add-cert-empty-options"]').exists()).toBe(false)

    resolveEnrollments(
      okEnvelope([]) as Awaited<ReturnType<typeof userCertificationsControllerList>>,
    )
    await flushPromises()

    expect(wrapper.find('[data-testid="add-cert-loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-cert-id="cert-1"]').exists()).toBe(true)
  })

  it('keeps loading while one list is pending even if its sibling has failed', async () => {
    let resolveEnrollments: (
      value: Awaited<ReturnType<typeof userCertificationsControllerList>>,
    ) => void = () => {}
    vi.mocked(certificationsControllerList).mockRejectedValue(new Error('Unavailable'))
    vi.mocked(userCertificationsControllerList).mockReturnValue(
      new Promise((resolve) => {
        resolveEnrollments = resolve
      }),
    )

    const { wrapper } = mountModal()
    await flushPromises()

    expect(wrapper.find('[data-testid="add-cert-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="add-cert-list-error"]').exists()).toBe(false)

    resolveEnrollments(
      okEnvelope([]) as Awaited<ReturnType<typeof userCertificationsControllerList>>,
    )
    await flushPromises()

    expect(wrapper.find('[data-testid="add-cert-loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-cert-list-error"]').exists()).toBe(true)
  })

  it('shows a retryable list error without flashing the empty state', async () => {
    vi.mocked(certificationsControllerList)
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce(
        // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
        okEnvelope([certification({ id: 'cert-2', name: 'Azure Fundamentals' })]) as any,
      )
    vi.mocked(userCertificationsControllerList).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { wrapper } = mountModal()
    await flushPromises()

    expect(wrapper.get('[data-testid="add-cert-list-error"]').text()).toContain(
      'Couldn’t load available certifications.',
    )
    expect(wrapper.get('[data-testid="readion-async-error"]').attributes('role')).toBe('alert')
    expect(wrapper.find('[data-testid="add-cert-empty-options"]').exists()).toBe(false)

    await wrapper.get('[data-testid="readion-async-retry"]').trigger('click')
    await flushPromises()

    expect(certificationsControllerList).toHaveBeenCalledTimes(2)
    expect(userCertificationsControllerList).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-cert-id="cert-2"]').exists()).toBe(true)
  })

  it('preserves successful options while a list refetches and after its failure', async () => {
    stubData({
      certifications: [
        certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      ],
      enrollments: [],
    })

    const { wrapper, queryClient } = mountModal()
    await flushPromises()
    expect(wrapper.find('[data-cert-id="cert-2"]').exists()).toBe(true)

    let rejectRefresh = (_error: Error) => {}
    vi.mocked(certificationsControllerList).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectRefresh = reject
      }),
    )
    const refresh = queryClient.refetchQueries({
      queryKey: dashboardQueryKeys.certifications(),
    })
    await vi.waitFor(() => expect(certificationsControllerList).toHaveBeenCalledTimes(2))

    expect(wrapper.find('[data-cert-id="cert-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="readion-async-refresh"]').exists()).toBe(true)

    rejectRefresh(new Error('Refresh failed'))
    await refresh
    await flushPromises()

    expect(wrapper.find('[data-cert-id="cert-2"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="add-cert-list-refresh-error"]').attributes('role')).toBe(
      'alert',
    )
  })

  it('lists certifications that are not in the active enrollments', async () => {
    stubData({
      certifications: [
        certification({ id: 'cert-1', name: 'AWS SA' }),
        certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
        certification({ id: 'cert-3', name: 'CKA', provider: 'CNCF' }),
      ],
      enrollments: [enrollment('cert-1')],
    })

    const { wrapper } = mountModal()
    await flushPromises()

    const optionEls = wrapper.findAll('[data-testid="add-cert-option"]')
    expect(optionEls).toHaveLength(2)
    const ids = optionEls.map((el) => el.attributes('data-cert-id'))
    expect(ids).toEqual(['cert-2', 'cert-3'])
    expect(wrapper.text()).toContain('Azure Fundamentals')
    expect(wrapper.text()).toContain('Azure')
    expect(wrapper.text()).not.toContain('AWS SA')
  })

  it('shows a message when every certification is already enrolled', async () => {
    stubData({
      certifications: [certification({ id: 'cert-1', name: 'AWS SA' })],
      enrollments: [enrollment('cert-1')],
    })

    const { wrapper } = mountModal()
    await flushPromises()

    expect(wrapper.findAll('[data-testid="add-cert-option"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="add-cert-empty-options"]').exists()).toBe(true)
  })

  it('does not render the dialog when closed', () => {
    stubData({ certifications: [], enrollments: [] })
    const { wrapper } = mountModal(false)
    expect(wrapper.find('[data-testid="add-cert-modal"]').exists()).toBe(false)
  })
})

describe('AddCertificationModal enroll', () => {
  it('keeps the selected certification identifiable with Adding… while enrollment is pending', async () => {
    stubData({
      certifications: [
        certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
        certification({ id: 'cert-3', name: 'CKA', provider: 'CNCF' }),
      ],
      enrollments: [],
    })
    let resolveEnroll = () => {}
    vi.mocked(userCertificationsControllerEnroll).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnroll = () =>
            resolve(
              // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
              okEnvelope([]) as any,
            )
        }),
    )

    const { wrapper } = mountModal()
    await flushPromises()
    const selected = wrapper.get('[data-cert-id="cert-2"]')
    await selected.trigger('click')

    expect(selected.attributes('aria-busy')).toBe('true')
    expect(selected.text()).toContain('Azure Fundamentals')
    expect(selected.text()).toContain('Adding…')
    await selected.trigger('click')
    expect(userCertificationsControllerEnroll).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-cert-id="cert-3"]').attributes('disabled')).toBeDefined()

    resolveEnroll()
    await flushPromises()
  })

  it('preserves the selected context and explicit retry after enrollment fails', async () => {
    stubData({
      certifications: [
        certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      ],
      enrollments: [],
    })
    vi.mocked(userCertificationsControllerEnroll).mockRejectedValueOnce(new Error('Unavailable'))
    vi.mocked(userCertificationsControllerEnroll).mockResolvedValueOnce(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { wrapper } = mountModal()
    await flushPromises()
    await wrapper.get('[data-cert-id="cert-2"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain("Couldn't add Azure Fundamentals")
    expect(wrapper.get('[data-cert-id="cert-2"]').attributes('data-selected')).toBe('true')
    expect(wrapper.get('[data-cert-id="cert-2"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-cert-id="cert-2"]').trigger('click')
    await flushPromises()
    expect(userCertificationsControllerEnroll).toHaveBeenCalledTimes(2)
  })

  it('enrolls in the selected certification with defaults', async () => {
    stubData({
      certifications: [
        certification({ id: 'cert-1', name: 'AWS SA' }),
        certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      ],
      enrollments: [enrollment('cert-1')],
    })
    vi.mocked(userCertificationsControllerEnroll).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { wrapper } = mountModal()
    await flushPromises()

    await wrapper.find('[data-cert-id="cert-2"]').trigger('click')
    await flushPromises()

    expect(userCertificationsControllerEnroll).toHaveBeenCalledTimes(1)
    expect(userCertificationsControllerEnroll).toHaveBeenCalledWith(
      expect.objectContaining({ body: JSON.stringify({ certificationId: 'cert-2' }) }),
    )
  })

  it('closes the modal on a successful enroll', async () => {
    stubData({
      certifications: [
        certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      ],
      enrollments: [],
    })
    vi.mocked(userCertificationsControllerEnroll).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { wrapper } = mountModal()
    await flushPromises()

    await wrapper.find('[data-cert-id="cert-2"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('invalidates the enrollments query so the dashboard refreshes', async () => {
    stubData({
      certifications: [
        certification({ id: 'cert-2', name: 'Azure Fundamentals', provider: 'Azure' }),
      ],
      enrollments: [],
    })
    vi.mocked(userCertificationsControllerEnroll).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      okEnvelope([]) as any,
    )

    const { wrapper, invalidateSpy } = mountModal()
    await flushPromises()

    await wrapper.find('[data-cert-id="cert-2"]').trigger('click')
    await flushPromises()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardQueryKeys.enrollments() })
  })
})

describe('AddCertificationModal close', () => {
  it('emits update:open false when the close control is activated', async () => {
    stubData({ certifications: [], enrollments: [] })
    const { wrapper } = mountModal()
    await flushPromises()

    await wrapper.find('[data-testid="add-cert-close"]').trigger('click')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })
})
