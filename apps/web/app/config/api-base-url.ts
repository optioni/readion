const requiredEnvName = 'NUXT_PUBLIC_API_BASE_URL'

export const resolvePublicApiBaseUrl = (env: NodeJS.ProcessEnv = process.env) => {
  const value = env[requiredEnvName]

  if (!value) {
    throw new Error(`${requiredEnvName} is required`)
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${requiredEnvName} must be a valid absolute URL`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${requiredEnvName} must be an HTTP(S) URL`)
  }

  return value
}

type ApiBaseUrlConfig = {
  internalApiBaseUrl?: string
  public: { apiBaseUrl: string }
}

// The browser reaches the API at the public URL; SSR (inside the cluster) must use the in-cluster
// service address when configured, because the public host hairpins out through the ingress tunnel
// and back — an authenticated server render would otherwise fail and fall back to the login layout.
export const selectApiBaseUrl = (isServer: boolean, config: ApiBaseUrlConfig): string =>
  isServer && config.internalApiBaseUrl ? config.internalApiBaseUrl : config.public.apiBaseUrl

export const resolveApiBaseUrl = (config: ApiBaseUrlConfig): string =>
  selectApiBaseUrl(import.meta.server, config)
