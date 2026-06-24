import { computed, ref } from 'vue'
import type { ProblemDetails } from '~/api/mutator'

export type FieldError = { path: string; message: string }

export function useCredentialForm() {
  const email = ref('')
  const password = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const fieldErrors = ref<FieldError[]>([])

  const passwordStrength = computed(() => {
    const p = password.value
    if (p.length === 0) return 0
    if (p.length < 8) return 1
    let score = 1
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score
  })

  const strengthLabel = computed(() => {
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
    return labels[passwordStrength.value] ?? ''
  })

  const strengthColor = computed(() => {
    const colors = ['', '#f87171', '#f87171', '#fb923c', '#34d399']
    return colors[passwordStrength.value] ?? 'transparent'
  })

  function fieldError(path: string) {
    return fieldErrors.value.find((e) => e.path === path)?.message ?? null
  }

  function parseFieldErrors(problem: ProblemDetails) {
    if (Array.isArray(problem.errors)) {
      fieldErrors.value = problem.errors as FieldError[]
    }
  }

  function clearErrors() {
    fieldErrors.value = []
  }

  return {
    email,
    password,
    showPassword,
    loading,
    fieldErrors,
    passwordStrength,
    strengthLabel,
    strengthColor,
    fieldError,
    parseFieldErrors,
    clearErrors,
  }
}
