import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveMockExamAnswer } from '~/composables/mockExamApi'
import { seedAnswers, useMockExamAnswers } from '~/composables/useMockExamAnswers'

vi.mock('~/composables/mockExamApi', () => ({
  saveMockExamAnswer: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveMockExamAnswer).mockResolvedValue(
    undefined as unknown as Awaited<ReturnType<typeof saveMockExamAnswer>>,
  )
})

describe('seedAnswers', () => {
  it('keeps only the questions that already carry an answer, keyed by index', () => {
    const map = seedAnswers([
      { userAnswer: 'a' },
      { userAnswer: null },
      { userAnswer: 'c' },
      { userAnswer: undefined },
    ])

    expect([...map.entries()]).toEqual([
      [0, 'a'],
      [2, 'c'],
    ])
  })
})

describe('useMockExamAnswers', () => {
  it('seeds answered indices from existing answers', () => {
    const { answeredIndices, answerFor } = useMockExamAnswers('exam-1', [
      { userAnswer: 'a' },
      { userAnswer: null },
    ])

    expect(answeredIndices.value).toEqual([0])
    expect(answerFor(0)).toBe('a')
    expect(answerFor(1)).toBeUndefined()
  })

  it('optimistically records an answer and persists it by zero-based index', async () => {
    const { answeredIndices, answerFor, recordAnswer } = useMockExamAnswers('exam-1', [
      { userAnswer: null },
      { userAnswer: null },
    ])

    await recordAnswer(1, 'chosen')

    expect(answerFor(1)).toBe('chosen')
    expect(answeredIndices.value).toContain(1)
    expect(saveMockExamAnswer).toHaveBeenCalledWith('exam-1', 1, { answer: 'chosen' })
  })

  it('overwrites the answer at the same index when re-recorded', async () => {
    const { answerFor, recordAnswer } = useMockExamAnswers('exam-1', [{ userAnswer: null }])

    await recordAnswer(0, 'first')
    await recordAnswer(0, 'second')

    expect(answerFor(0)).toBe('second')
    expect(saveMockExamAnswer).toHaveBeenNthCalledWith(2, 'exam-1', 0, { answer: 'second' })
  })
})
