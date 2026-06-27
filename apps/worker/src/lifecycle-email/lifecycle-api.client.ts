import { Injectable } from '@nestjs/common'
import type { LifecycleDigestRequest, LifecycleNudgeRequest } from '@readion/shared'

// Header carrying the shared secret on worker→API internal lifecycle calls.
// The internal API guard reads this same header to authenticate the caller.
export const INTERNAL_API_SECRET_HEADER = 'x-internal-api-secret'

export const LIFECYCLE_API_CLIENT = Symbol('LIFECYCLE_API_CLIENT')

@Injectable()
export class LifecycleApiClient {
  private readonly baseUrl: string
  private readonly secret: string
  private readonly timeoutMs: number

  constructor(baseUrl: string, secret: string, timeoutMs = 30_000) {
    this.baseUrl = baseUrl
    this.secret = secret
    this.timeoutMs = timeoutMs
  }

  async triggerDigest(userIds: string[]): Promise<void> {
    const requestUrl = new URL('/internal/lifecycle/digest', this.baseUrl)
    const body: LifecycleDigestRequest = { userIds }

    const response = await globalThis.fetch(requestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INTERNAL_API_SECRET_HEADER]: this.secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Internal digest trigger failed with status ${response.status}`)
    }
  }

  async triggerNudge(userCertificationIds: string[]): Promise<void> {
    const requestUrl = new URL('/internal/lifecycle/nudge', this.baseUrl)
    const body: LifecycleNudgeRequest = { userCertificationIds }

    const response = await globalThis.fetch(requestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INTERNAL_API_SECRET_HEADER]: this.secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Internal nudge trigger failed with status ${response.status}`)
    }
  }
}
