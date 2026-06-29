import { describe, expect, it } from 'vitest'
import { selectMockExamScene } from '~/composables/mockExamScene'

describe('selectMockExamScene', () => {
  it('returns "preparing" whenever generation is preparing, regardless of status', () => {
    expect(selectMockExamScene({ generation: 'preparing', status: 'in_progress' })).toBe(
      'preparing',
    )
    expect(selectMockExamScene({ generation: 'preparing', status: 'submitted' })).toBe('preparing')
    expect(selectMockExamScene({ generation: 'preparing', status: 'expired' })).toBe('preparing')
  })

  it('returns "active" once ready and still in progress', () => {
    expect(selectMockExamScene({ generation: 'ready', status: 'in_progress' })).toBe('active')
  })

  it('returns "results" for terminal statuses once ready', () => {
    expect(selectMockExamScene({ generation: 'ready', status: 'submitted' })).toBe('results')
    expect(selectMockExamScene({ generation: 'ready', status: 'expired' })).toBe('results')
  })
})
