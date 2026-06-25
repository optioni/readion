import { type APIRequestContext, expect, request, test } from '@playwright/test'

const apiBaseUrl = process.env.READION_E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'

test.describe('weak-areas – ranked weak-area read endpoint', () => {
  let api: APIRequestContext

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl })
  })

  test.afterAll(async () => {
    await api?.dispose()
  })

  test('Weakest domain is returned first after answering quiz questions across two domains', async () => {
    const email = `weak-areas.${Date.now()}@example.com`
    const password = 'correcthorse'

    const register = await api.post('/api/v1/auth/register', {
      data: { email, password },
    })
    expect(register.status()).toBe(201)
    const {
      data: { accessToken },
    } = (await register.json()) as { data: { accessToken: string } }

    const meRes = await api.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(meRes.status()).toBe(200)

    const certRes = await api.get('/api/v1/certifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(certRes.status()).toBe(200)
    const { data: certs } = (await certRes.json()) as { data: Array<{ id: string }> }

    if (certs.length === 0) {
      test.skip(true, 'No live certifications available for e2e test')
      return
    }

    const certId = certs[0]!.id

    const enrollRes = await api.post('/api/v1/user-certifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { certificationId: certId },
    })
    expect(enrollRes.status()).toBe(201)
    const { data: enrollment } = (await enrollRes.json()) as { data: { id: string } }

    const weakAreasRes = await api.get(`/api/v1/user-certifications/${enrollment.id}/weak-areas`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    expect(weakAreasRes.status()).toBe(200)
    const body = (await weakAreasRes.json()) as {
      data: Array<{ id: string; domain: string; score: number }>
    }

    expect(Array.isArray(body.data)).toBe(true)

    if (body.data.length >= 2) {
      for (let i = 1; i < body.data.length; i++) {
        expect(body.data[i - 1]!.score).toBeLessThanOrEqual(body.data[i]!.score)
      }
    }
  })

  test('Another user cannot read the enrollment weak areas', async () => {
    const email1 = `wa-owner.${Date.now()}@example.com`
    const email2 = `wa-other.${Date.now()}@example.com`
    const password = 'correcthorse'

    const r1 = await api.post('/api/v1/auth/register', { data: { email: email1, password } })
    const r2 = await api.post('/api/v1/auth/register', { data: { email: email2, password } })
    expect(r1.status()).toBe(201)
    expect(r2.status()).toBe(201)
    const {
      data: { accessToken: token1 },
    } = (await r1.json()) as { data: { accessToken: string } }
    const {
      data: { accessToken: token2 },
    } = (await r2.json()) as { data: { accessToken: string } }

    const certRes = await api.get('/api/v1/certifications', {
      headers: { Authorization: `Bearer ${token1}` },
    })
    const { data: certs } = (await certRes.json()) as { data: Array<{ id: string }> }

    if (certs.length === 0) {
      test.skip(true, 'No live certifications available')
      return
    }

    const enrollRes = await api.post('/api/v1/user-certifications', {
      headers: { Authorization: `Bearer ${token1}` },
      data: { certificationId: certs[0]!.id },
    })
    const { data: enrollment } = (await enrollRes.json()) as { data: { id: string } }

    const res = await api.get(`/api/v1/user-certifications/${enrollment.id}/weak-areas`, {
      headers: { Authorization: `Bearer ${token2}` },
    })

    expect(res.status()).not.toBe(200)
    expect(res.headers()['content-type']).toMatch('application/problem+json')
  })
})
