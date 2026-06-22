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

export const createReadionFetch =
  ({ apiBaseUrl, getAccessToken }: ReadionFetchFactoryOptions) =>
  async <TResponse>(path: string, options: ReadionFetchOptions = {}): Promise<TResponse> => {
    const headers = new Headers(options.headers)
    const accessToken = getAccessToken?.()

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    const response = await fetch(buildUrl(apiBaseUrl, path, options.params), {
      ...options,
      credentials: 'include',
      headers,
    })

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
  return createReadionFetch({
    apiBaseUrl: runtimeConfig.public.apiBaseUrl,
  })(path, options)
}
