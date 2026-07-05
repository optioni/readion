import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { injectUmamiScript, umamiScriptSrc, watchIdentify } from '~/composables/umamiBootstrap'

describe('injectUmamiScript', () => {
  // A detached document (no browsing context) so appending an external <script> records the DOM
  // without happy-dom attempting to fetch it.
  let doc: Document

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('t')
  })

  it('injects one script with the correct src and data-website-id when both vars are set', () => {
    const injected = injectUmamiScript(doc, {
      host: 'https://analytics.optioni.fi',
      websiteId: 'site-abc',
    })

    const scripts = doc.head.querySelectorAll('script')
    expect(injected).toBe(true)
    expect(scripts).toHaveLength(1)
    expect(scripts[0]?.getAttribute('src')).toBe('https://analytics.optioni.fi/script.js')
    expect(scripts[0]?.getAttribute('data-website-id')).toBe('site-abc')
  })

  it('normalizes a trailing slash on the host', () => {
    expect(umamiScriptSrc('https://analytics.optioni.fi/')).toBe(
      'https://analytics.optioni.fi/script.js',
    )
  })

  it('skips injection when the website id is empty', () => {
    const injected = injectUmamiScript(doc, {
      host: 'https://analytics.optioni.fi',
      websiteId: '',
    })

    expect(injected).toBe(false)
    expect(doc.head.querySelectorAll('script')).toHaveLength(0)
  })

  it('skips injection when the host is empty', () => {
    const injected = injectUmamiScript(doc, { host: '', websiteId: 'site-abc' })
    expect(injected).toBe(false)
    expect(doc.head.querySelectorAll('script')).toHaveLength(0)
  })

  it('never double-injects the same tracker', () => {
    const config = { host: 'https://analytics.optioni.fi', websiteId: 'site-abc' }
    expect(injectUmamiScript(doc, config)).toBe(true)
    expect(injectUmamiScript(doc, config)).toBe(false)
    expect(doc.head.querySelectorAll('script')).toHaveLength(1)
  })
})

describe('watchIdentify', () => {
  it('identifies with the UUID when the user becomes authenticated', async () => {
    const userId = ref<string | null>(null)
    const identify = vi.fn()

    const stop = watchIdentify(() => userId.value, identify)
    expect(identify).not.toHaveBeenCalled()

    userId.value = '11111111-1111-1111-1111-111111111111'
    await nextTick()

    expect(identify).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
    stop()
  })

  it('does not identify while unauthenticated', async () => {
    const userId = ref<string | null>(null)
    const identify = vi.fn()

    const stop = watchIdentify(() => userId.value, identify)
    await nextTick()

    expect(identify).not.toHaveBeenCalled()
    stop()
  })
})
