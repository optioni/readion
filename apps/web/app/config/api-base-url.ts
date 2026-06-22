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
