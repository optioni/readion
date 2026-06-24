import type { OutputOptions } from '@orval/core'
import { describe, expect, it } from 'vitest'

describe('Orval config', () => {
  it('uses the Readion fetch mutator for the committed web client', async () => {
    const { default: rawConfig } = await import('../../../../orval.config')
    const config = rawConfig as Record<string, { output: OutputOptions }>
    const readionConfig = config.readion

    expect(readionConfig).toBeDefined()
    if (!readionConfig) {
      throw new Error('Readion Orval config is missing')
    }

    const output = readionConfig.output

    expect(output.target).toBe('apps/web/src/api/index.ts')
    expect(output.override?.mutator).toEqual({
      path: 'apps/web/app/api/mutator.ts',
      name: 'readionFetch',
    })
  })
})
