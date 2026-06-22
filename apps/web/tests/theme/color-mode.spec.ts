import { describe, expect, it } from 'vitest'
import { useReadionColorMode } from '~/composables/useReadionColorMode'

describe('Readion color mode', () => {
  it('defaults to dark and persists a toggled preference', () => {
    window.localStorage.clear()
    document.documentElement.className = ''

    const firstLoad = useReadionColorMode()
    expect(firstLoad.preference.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    firstLoad.toggle()
    expect(firstLoad.preference.value).toBe('light')
    expect(window.localStorage.getItem('readion-color-mode')).toBe('light')

    document.documentElement.className = ''
    const nextLoad = useReadionColorMode()
    expect(nextLoad.preference.value).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('falls back to dark when stored preference is invalid', () => {
    window.localStorage.setItem('readion-color-mode', 'system')
    document.documentElement.className = ''

    const colorMode = useReadionColorMode()

    expect(colorMode.preference.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
