import { describe, expect, it } from 'vitest'
import { mockExamQueryKeys } from '~/composables/mockExamQueryKeys'

describe('mockExamQueryKeys', () => {
  it('builds the detail key from a mock-exam id', () => {
    expect(mockExamQueryKeys.detail('me-1')).toEqual(['mock-exam', 'detail', 'me-1'])
  })

  it('builds the summary key from a mock-exam id', () => {
    expect(mockExamQueryKeys.summary('me-1')).toEqual(['mock-exam', 'summary', 'me-1'])
  })
})
