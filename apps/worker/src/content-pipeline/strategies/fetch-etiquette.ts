export const USER_AGENT = 'Readion-Ingestion/1.0 (+https://readion.app/bot)'

const lastRequestTime = new Map<string, number>()
const RATE_LIMIT_MS = 1_000

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export async function throttleForDomain(domain: string): Promise<void> {
  const last = lastRequestTime.get(domain)
  if (last !== undefined) {
    const elapsed = Date.now() - last
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed))
    }
  }
  lastRequestTime.set(domain, Date.now())
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(url)
    const robotsUrl = `${protocol}//${hostname}/robots.txt`
    const res = await globalThis.fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return true
    const text = await res.text()
    return !isDisallowed(text, url)
  } catch {
    return true
  }
}

function isDisallowed(robotsTxt: string, targetUrl: string): boolean {
  const path = new URL(targetUrl).pathname
  const lines = robotsTxt.split('\n')
  let inReadionAgent = false
  let inAllAgents = false

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('User-agent:')) {
      const agent = line.slice('User-agent:'.length).trim()
      inReadionAgent = agent === '*' || agent.toLowerCase().includes('readion')
      inAllAgents = agent === '*'
    }
    if ((inReadionAgent || inAllAgents) && line.startsWith('Disallow:')) {
      const disallowed = line.slice('Disallow:'.length).trim()
      if (disallowed && path.startsWith(disallowed)) return true
    }
  }
  return false
}

export async function politelyFetch(url: string, options?: RequestInit): Promise<Response> {
  const domain = extractDomain(url)
  const allowed = await isAllowedByRobots(url)
  if (!allowed) {
    throw new Error(`Fetch of ${url} disallowed by robots.txt`)
  }
  await throttleForDomain(domain)
  return globalThis.fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      ...(options?.headers as Record<string, string>),
    },
  })
}
