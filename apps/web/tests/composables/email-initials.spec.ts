import { describe, expect, it } from 'vitest'
import { emailInitials } from '~/composables/emailInitials'

describe('emailInitials', () => {
  it('derives two uppercase letters from the local part', () => {
    expect(emailInitials('casey@org.io')).toBe('CA')
  })

  it('skips non-letters in the local part', () => {
    expect(emailInitials('a1b2c3@org.io')).toBe('AB')
  })

  it('falls back to the first characters when the local part has no letters', () => {
    expect(emailInitials('123@org.io')).toBe('12')
  })

  it('uses the whole string when there is no @ separator', () => {
    expect(emailInitials('plainname')).toBe('PL')
  })
})
