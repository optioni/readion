import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CertSetupSourcesStep from '~/components/admin/CertSetupSourcesStep.vue'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useCertSetupWizard } from '~/composables/useCertSetupWizard'
import { contentControllerRegister } from '~~/src/api/content/content'

vi.mock('~~/src/api/content/content')

const CERT_ID = 'c0000000-0000-0000-0000-000000000002'

function registered() {
  return {
    data: { data: { id: 'd1' } },
    status: 201,
    headers: new Headers(),
    // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
  } as any
}

function mountStep() {
  const wizard = useCertSetupWizard()
  wizard.state.createdCertId = CERT_ID
  wizard.state.suggestedContentSources = [
    { url: 'https://docs.aws.amazon.com/', type: 'web' },
    { url: 'https://www.youtube.com/watch?v=saa', type: 'youtube' },
  ]
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(CertSetupSourcesStep, {
    props: { state: wizard.state, certId: CERT_ID },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, invalidateSpy }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('CertSetupSourcesStep suggested sources', () => {
  it('renders a suggested source per entry with no pending-review pill', () => {
    const { wrapper } = mountStep()
    expect(wrapper.findAll('[data-testid="suggested-source"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="source-pending-pill"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="source-upload-input"]').exists()).toBe(false)
  })

  it('approves a suggested source by registering it and refetching coverage', async () => {
    vi.mocked(contentControllerRegister).mockResolvedValue(registered())
    const { wrapper, invalidateSpy } = mountStep()

    await wrapper
      .find('[data-testid="suggested-source"] [data-testid="approve-source-btn"]')
      .trigger('click')
    await flushPromises()

    expect(contentControllerRegister).toHaveBeenCalledTimes(1)
    const body = JSON.parse(vi.mocked(contentControllerRegister).mock.calls[0]?.[0]?.body as string)
    expect(body).toEqual({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://docs.aws.amazon.com/',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.coverage(CERT_ID) })
    expect(wrapper.findAll('[data-testid="suggested-source"]')).toHaveLength(1)
  })

  it('rejects a suggested source client-side without any request', async () => {
    const { wrapper } = mountStep()

    await wrapper
      .find('[data-testid="suggested-source"] [data-testid="reject-source-btn"]')
      .trigger('click')
    await flushPromises()

    expect(contentControllerRegister).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="suggested-source"]')).toHaveLength(1)
  })
})

describe('CertSetupSourcesStep manual add', () => {
  it('does not offer quizlet as a source type option', () => {
    const { wrapper } = mountStep()

    const values = wrapper
      .find('[data-testid="cert-source-type-select"]')
      .findAll('option')
      .map((option) => option.element.value)

    expect(values).not.toContain('quizlet')
  })

  it('registers a manually entered url and invalidates coverage', async () => {
    vi.mocked(contentControllerRegister).mockResolvedValue(registered())
    const { wrapper, invalidateSpy } = mountStep()

    await wrapper
      .find('[data-testid="cert-source-url-input"]')
      .setValue('https://example.com/guide')
    await wrapper.find('[data-testid="cert-source-type-select"]').setValue('web')
    await wrapper.find('[data-testid="cert-source-add-btn"]').trigger('submit')
    await flushPromises()

    expect(contentControllerRegister).toHaveBeenCalledTimes(1)
    const body = JSON.parse(vi.mocked(contentControllerRegister).mock.calls[0]?.[0]?.body as string)
    expect(body).toEqual({
      certificationId: CERT_ID,
      type: 'web',
      url: 'https://example.com/guide',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.coverage(CERT_ID) })
  })

  it('rejects an invalid manual url without calling the API', async () => {
    const { wrapper } = mountStep()

    await wrapper.find('[data-testid="cert-source-url-input"]').setValue('not-a-url')
    await wrapper.find('[data-testid="cert-source-add-btn"]').trigger('submit')
    await flushPromises()

    expect(contentControllerRegister).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cert-source-error"]').exists()).toBe(true)
  })
})
