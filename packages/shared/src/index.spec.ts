import { describe, expect, it } from 'vitest'
import { APP_NAME } from './index'

describe('@readion/shared exports', () => {
  it('exports APP_NAME constant', () => {
    expect(APP_NAME).toBe('Readion')
  })
})
