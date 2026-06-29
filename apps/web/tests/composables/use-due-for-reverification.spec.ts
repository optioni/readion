import type { DueForReverificationItem } from '@readion/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useDueForReverification } from '~/composables/useDueForReverification'
import { certSetupControllerListDueForReverification } from '~~/src/api/cert-setup/cert-setup'
import { renderComposable } from '../support/vue-query-harness'

vi.mock('~~/src/api/cert-setup/cert-setup')

const DUE: DueForReverificationItem[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'AWS Certified Solutions Architect — Associate',
    code: 'SAA-C03',
    verifiedAt: '2025-06-01T00:00:00.000Z',
    dueForReverification: true,
  },
]

const dueEnvelope = {
  data: { data: DUE },
  status: 200,
  headers: new Headers(),
}

describe('useDueForReverification', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reads and narrows the due-for-reverification envelope', async () => {
    vi.mocked(certSetupControllerListDueForReverification).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      dueEnvelope as any,
    )

    const { result } = renderComposable(() => useDueForReverification())

    await vi.waitFor(() => {
      expect(result.data.value).toEqual(DUE)
    })
    expect(certSetupControllerListDueForReverification).toHaveBeenCalledOnce()
  })

  it('caches the due list under the shared admin key', async () => {
    vi.mocked(certSetupControllerListDueForReverification).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: generated envelope type narrowed in tests
      dueEnvelope as any,
    )

    const { result, queryClient } = renderComposable(() => useDueForReverification())

    await vi.waitFor(() => {
      expect(result.data.value).toBeDefined()
    })
    expect(queryClient.getQueryData(adminQueryKeys.dueForReverification())).toEqual(DUE)
  })
})
