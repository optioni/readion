import { type APIRequestContext, expect, request, test } from '@playwright/test'

const apiBaseUrl = process.env.READION_E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'
const mailpitBaseUrl = process.env.READION_E2E_MAILPIT_BASE_URL ?? 'http://127.0.0.1:8025'

type MailpitMessageSummary = {
  ID: string
  To: Array<{ Address: string }>
  Subject: string
}

type MailpitMessagesResponse = {
  messages: MailpitMessageSummary[]
}

type MailpitMessageDetail = {
  Text?: string
  HTML?: string
}

test.describe('auth happy path', () => {
  let api: APIRequestContext
  let mailpit: APIRequestContext

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl })
    mailpit = await request.newContext({ baseURL: mailpitBaseUrl })
    await mailpit.delete('/api/v1/messages')
  })

  test.afterAll(async () => {
    await api?.dispose()
    await mailpit?.dispose()
  })

  test('registers, verifies by local mail, logs in, refreshes, reaches protected API, and logs out', async () => {
    const email = `grace.${Date.now()}@example.com`
    const password = 'correcthorse'

    const register = await api.post('/api/v1/auth/register', {
      data: { email, password },
    })

    expect(register.status()).toBe(201)
    const registerBody = await register.json()
    expect(registerBody.data.user).toMatchObject({
      email,
      emailVerified: false,
    })
    expect(registerBody.data.user).not.toHaveProperty('password')
    expect(registerBody.data.accessToken).toEqual(expect.any(String))
    expect(registerBody.data).not.toHaveProperty('refreshToken')

    const verificationLink = await findVerificationLink(email)
    expect(verificationLink.origin).toBe('http://localhost:3000')
    const verificationToken = verificationLink.searchParams.get('token')
    expect(verificationToken).toEqual(expect.any(String))

    const verify = await api.post('/api/v1/auth/verify-email', {
      data: { token: verificationToken },
    })
    expect(verify.status()).toBe(200)

    const login = await api.post('/api/v1/auth/login', {
      data: { email, password },
    })
    expect(login.status()).toBe(200)
    const loginBody = await login.json()
    expect(loginBody.data.accessToken).toEqual(expect.any(String))

    const loginCookies = getSetCookieValues(login)
    const refreshCookie = getCookieHeader(loginCookies, 'refresh_token')
    const csrfCookie = getCookieHeader(loginCookies, 'csrf_token')
    const csrfToken = getCookieValue(loginCookies, 'csrf_token')
    expect(refreshCookie).toEqual(expect.any(String))
    expect(csrfCookie).toEqual(expect.any(String))
    expect(csrfToken).toEqual(expect.any(String))

    const protectedResource = await api.post('/api/v1/auth/resend-verification', {
      headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
    })
    expect(protectedResource.status()).toBe(200)

    const refresh = await api.post('/api/v1/auth/refresh', {
      headers: {
        Cookie: [refreshCookie, csrfCookie].filter(Boolean).join('; '),
        'X-CSRF-Token': csrfToken ?? '',
      },
    })
    expect(refresh.status()).toBe(200)
    const refreshBody = await refresh.json()
    expect(refreshBody.data.accessToken).toEqual(expect.any(String))

    const rotatedCookies = getSetCookieValues(refresh)
    const rotatedRefreshCookie = getCookieHeader(rotatedCookies, 'refresh_token')
    const rotatedCsrfCookie = getCookieHeader(rotatedCookies, 'csrf_token')
    const rotatedCsrfToken = getCookieValue(rotatedCookies, 'csrf_token')

    const logout = await api.post('/api/v1/auth/logout', {
      headers: {
        Authorization: `Bearer ${refreshBody.data.accessToken}`,
        Cookie: [rotatedRefreshCookie, rotatedCsrfCookie].filter(Boolean).join('; '),
        'X-CSRF-Token': rotatedCsrfToken ?? '',
      },
    })
    expect(logout.status()).toBe(200)

    const afterLogout = await api.post('/api/v1/auth/refresh', {
      headers: {
        Cookie: [rotatedRefreshCookie, rotatedCsrfCookie].filter(Boolean).join('; '),
        'X-CSRF-Token': rotatedCsrfToken ?? '',
      },
    })
    expect(afterLogout.status()).toBe(401)
  })

  async function findVerificationLink(email: string) {
    const message = await waitForMessage(email)

    const detailResponse = await mailpit.get(`/api/v1/message/${message.ID}`)
    expect(detailResponse.ok()).toBe(true)
    const detail = (await detailResponse.json()) as MailpitMessageDetail
    const body = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`
    const match = body.match(/https?:\/\/[^\s"'<>]+/)

    if (!match) {
      throw new Error(`Verification email for ${email} did not contain a link`)
    }

    return new URL(match[0])
  }

  async function waitForMessage(email: string) {
    const deadline = Date.now() + 10_000

    while (Date.now() < deadline) {
      const message = await findMessage(email)

      if (message !== null) {
        return message
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    throw new Error(`Timed out waiting for verification email to ${email}`)
  }

  async function findMessage(email: string) {
    const response = await mailpit.get('/api/v1/messages')

    if (!response.ok()) {
      return null
    }

    const body = (await response.json()) as MailpitMessagesResponse
    return (
      body.messages.find((message) =>
        message.To.some((recipient) => recipient.Address.toLowerCase() === email.toLowerCase()),
      ) ?? null
    )
  }
})

function getSetCookieValues(response: { headersArray(): Array<{ name: string; value: string }> }) {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value)
}

function getCookieValue(setCookieHeaders: string[] | undefined, cookieName: string) {
  const cookie = setCookieHeaders?.find((header) => header.startsWith(`${cookieName}=`))
  return cookie?.split(';')[0].slice(cookieName.length + 1)
}

function getCookieHeader(setCookieHeaders: string[] | undefined, cookieName: string) {
  return setCookieHeaders?.find((header) => header.startsWith(`${cookieName}=`))?.split(';')[0]
}
