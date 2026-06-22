import { ref } from 'vue'

type ReadionColorMode = 'dark' | 'light'

const storageKey = 'readion-color-mode'

const isReadionColorMode = (value: string | null): value is ReadionColorMode =>
  value === 'dark' || value === 'light'

const readStoredPreference = (): ReadionColorMode => {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem(storageKey)
  return isReadionColorMode(stored) ? stored : 'dark'
}

const applyPreference = (preference: ReadionColorMode) => {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('dark', preference === 'dark')
  document.documentElement.classList.toggle('light', preference === 'light')
}

export const useReadionColorMode = () => {
  const preference = ref<ReadionColorMode>(readStoredPreference())

  const setPreference = (nextPreference: ReadionColorMode) => {
    preference.value = nextPreference

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, nextPreference)
    }

    applyPreference(nextPreference)
  }

  const toggle = () => {
    setPreference(preference.value === 'dark' ? 'light' : 'dark')
  }

  applyPreference(preference.value)

  return {
    preference,
    setPreference,
    toggle,
  }
}
