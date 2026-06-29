import { describe, expect, it } from 'vitest'
import { optionRevealState } from '~/composables/examOptionState'

const CORRECT = 'Convert the instance to a Multi-AZ deployment'
const CHOSEN_WRONG = 'Add a cross-region read replica'
const OTHER = 'Increase the instance size'

describe('optionRevealState', () => {
  describe('active mode (no correctAnswer)', () => {
    it('marks the chosen option selected and others rest', () => {
      expect(optionRevealState(CORRECT, CORRECT, undefined)).toBe('selected')
      expect(optionRevealState(OTHER, CORRECT, undefined)).toBe('rest')
    })

    it('treats a null answer as nothing selected', () => {
      expect(optionRevealState(CORRECT, null, undefined)).toBe('rest')
    })
  })

  describe('review mode (with correctAnswer)', () => {
    it('marks the correct option correct regardless of the user answer', () => {
      expect(optionRevealState(CORRECT, CHOSEN_WRONG, CORRECT)).toBe('correct')
      expect(optionRevealState(CORRECT, CORRECT, CORRECT)).toBe('correct')
      expect(optionRevealState(CORRECT, null, CORRECT)).toBe('correct')
    })

    it('marks the user-chosen wrong option incorrect', () => {
      expect(optionRevealState(CHOSEN_WRONG, CHOSEN_WRONG, CORRECT)).toBe('incorrect')
    })

    it('dims options that were neither chosen nor correct', () => {
      expect(optionRevealState(OTHER, CHOSEN_WRONG, CORRECT)).toBe('dim')
    })

    it('dims every non-correct option when the question was skipped', () => {
      expect(optionRevealState(CHOSEN_WRONG, null, CORRECT)).toBe('dim')
      expect(optionRevealState(OTHER, null, CORRECT)).toBe('dim')
    })
  })
})
