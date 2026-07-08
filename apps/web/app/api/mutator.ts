export type ReadionFetchOptions = RequestInit & {
  params?: Record<string, string | number | boolean | null | undefined>
}

export type ProblemDetails = {
  type?: string
  title: string
  status: number
  detail?: string
  errors?: unknown[]
}

type ReadionFetchFactoryOptions = {
  apiBaseUrl: string
  getAccessToken?: () => string | null | undefined
  getCsrfToken?: () => string | null | undefined
  onRefreshToken?: (newToken: string) => void
  onRefreshFailed?: () => void
}

export class ReadionProblemDetailsError extends Error implements ProblemDetails {
  type?: string
  status: number
  detail?: string
  errors?: unknown[]

  constructor(problem: ProblemDetails) {
    super(problem.title)
    this.name = 'ReadionProblemDetailsError'
    this.type = problem.type
    this.status = problem.status
    this.detail = problem.detail
    this.errors = problem.errors
  }

  get title() {
    return this.message
  }
}

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const REFRESH_PATH = '/api/v1/auth/refresh'

const buildUrl = (apiBaseUrl: string, path: string, params?: ReadionFetchOptions['params']) => {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`)

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

const parseProblemDetails = async (response: Response): Promise<ProblemDetails> => {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/problem+json')) {
    return (await response.json()) as ProblemDetails
  }

  return {
    title: response.statusText || 'Request failed',
    status: response.status,
  }
}

export const getCsrfTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))
  return match ? (match.slice(CSRF_COOKIE_NAME.length + 1) ?? null) : null
}

// Shared in-flight refresh promise — prevents parallel refresh storms
let refreshing: Promise<string | null> | null = null

export const createReadionFetch =
  ({
    apiBaseUrl,
    getAccessToken,
    getCsrfToken,
    onRefreshToken,
    onRefreshFailed,
  }: ReadionFetchFactoryOptions) =>
  async <TResponse>(path: string, options: ReadionFetchOptions = {}): Promise<TResponse> => {
    const method = (options.method ?? 'GET').toUpperCase()
    const accessToken = getAccessToken?.()
    const csrfToken = UNSAFE_METHODS.has(method) ? getCsrfToken?.() : null

    const buildHeaders = (token: string | null | undefined) => {
      const headers = new Headers(options.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (csrfToken) headers.set(CSRF_HEADER_NAME, csrfToken)
      return headers
    }

    const doFetch = (token: string | null | undefined) =>
      fetch(buildUrl(apiBaseUrl, path, options.params), {
        ...options,
        credentials: 'include',
        headers: buildHeaders(token),
      })

    let response = await doFetch(accessToken)

    if (response.status === 401 && onRefreshToken) {
      if (!refreshing) {
        const refreshUrl = buildUrl(apiBaseUrl, REFRESH_PATH, undefined)
        const csrfForRefresh = getCsrfTokenFromCookie()
        refreshing = fetch(refreshUrl, {
          method: 'POST',
          credentials: 'include',
          ...(csrfForRefresh ? { headers: { [CSRF_HEADER_NAME]: csrfForRefresh } } : {}),
        })
          .then(async (r) => {
            if (!r.ok) return null
            const body = (await r.json()) as { data?: { accessToken?: string } }
            return body?.data?.accessToken ?? null
          })
          .finally(() => {
            refreshing = null
          })
      }

      const newToken = await refreshing

      if (newToken) {
        onRefreshToken(newToken)
        response = await doFetch(newToken)
      } else {
        onRefreshFailed?.()
        throw new ReadionProblemDetailsError(await parseProblemDetails(response))
      }
    }

    if (!response.ok) {
      throw new ReadionProblemDetailsError(await parseProblemDetails(response))
    }

    const body = [204, 205, 304].includes(response.status) ? null : await response.text()
    const data = body ? JSON.parse(body) : undefined

    return {
      data,
      status: response.status,
      headers: response.headers,
    } as TResponse
  }

export const readionFetch = async <TResponse>(
  path: string,
  options?: ReadionFetchOptions,
): Promise<TResponse> => {
  const runtimeConfig = useRuntimeConfig()
  const { useAuthStore } = await import('~/stores/auth')
  const { resolveApiBaseUrl } = await import('~/config/api-base-url')
  const auth = useAuthStore()

  return createReadionFetch({
    apiBaseUrl: resolveApiBaseUrl(runtimeConfig),
    getAccessToken: () => auth.accessToken,
    getCsrfToken: getCsrfTokenFromCookie,
    onRefreshToken: (token) => auth.setSession(token, auth.user),
    onRefreshFailed: () => auth.clear(),
  })(path, options)
}
