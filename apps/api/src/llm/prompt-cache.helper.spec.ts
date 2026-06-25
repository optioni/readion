import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import { withCacheControl } from './prompt-cache.helper'

describe('withCacheControl', () => {
  it('marks a user message with anthropic cache-control for the anthropic provider', () => {
    const message: ModelMessage = { role: 'user', content: 'hello' }
    const result = withCacheControl(message, 'anthropic')
    expect(result.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })

  it('marks a system message with anthropic cache-control for the anthropic provider', () => {
    const message: ModelMessage = { role: 'system', content: 'You are a quiz generator.' }
    const result = withCacheControl(message, 'anthropic')
    expect(result.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })

  it('merges with existing providerOptions rather than replacing them', () => {
    const message: ModelMessage = {
      role: 'user',
      content: 'hello',
      providerOptions: { someOther: { flag: true } },
    }
    const result = withCacheControl(message, 'anthropic')
    expect(result.providerOptions).toEqual({
      someOther: { flag: true },
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })

  it('returns the same message reference unchanged for a non-supporting provider', () => {
    const message: ModelMessage = { role: 'user', content: 'hello' }
    const result = withCacheControl(message, 'openai')
    expect(result).toBe(message)
  })

  it('does not throw for a non-supporting provider', () => {
    const message: ModelMessage = { role: 'system', content: 'You are a helpful assistant.' }
    expect(() => withCacheControl(message, 'openai')).not.toThrow()
  })

  it('leaves content unchanged when adding cache-control', () => {
    const message: ModelMessage = { role: 'user', content: 'original content' }
    const result = withCacheControl(message, 'anthropic')
    expect(result.content).toBe('original content')
  })
})
