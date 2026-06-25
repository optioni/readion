import type { ModelMessage } from 'ai'

const CACHE_SUPPORTING_PROVIDERS = new Set(['anthropic'])

export function withCacheControl<T extends ModelMessage>(message: T, provider: string): T {
  if (!CACHE_SUPPORTING_PROVIDERS.has(provider)) {
    return message
  }
  return {
    ...message,
    providerOptions: {
      ...message.providerOptions,
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  }
}
