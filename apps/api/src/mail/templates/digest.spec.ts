import { describe, expect, it } from 'vitest'
import { type DigestTemplatePayload, digestTemplate } from './registry'
import { renderTemplate } from './renderer'

const payload = {
  productName: 'Readion',
  unsubscribeUrl: 'https://readion.app/api/v1/email/unsubscribe?token=abc.def-123',
  enrollments: [
    {
      certName: 'AWS Security Specialty',
      calibrated: true,
      readiness: 72,
      delta: 12,
      weakestDomain: 'Security',
      dueReviewCount: 3,
    },
    {
      certName: 'Azure Fundamentals',
      calibrated: false,
    },
  ],
} satisfies DigestTemplatePayload

describe('digest template', () => {
  it('renders a non-empty subject, text, and HTML wrapped in the base layout', () => {
    const rendered = renderTemplate(digestTemplate, payload)

    expect(rendered.subject).toBeTruthy()
    expect(rendered.text).toBeTruthy()
    expect(rendered.html).toMatch(/^<!doctype html>/i)
    expect(rendered.html).toContain('<html')
    expect(rendered.html).toContain('</html>')
  })

  it('renders the calibrated section with readiness, signed weekly delta, weakest domain, and due count', () => {
    const rendered = renderTemplate(digestTemplate, payload)

    expect(rendered.text).toContain('72%')
    expect(rendered.text).toMatch(/\+12% from last week/)
    expect(rendered.text).toContain('Security')
    expect(rendered.text).toContain('3 review item(s) due')

    expect(rendered.html).toContain('72%')
    expect(rendered.html).toMatch(/\+12% from last week/)
    expect(rendered.html).toContain('Security')
    expect(rendered.html).toContain('3 review item(s) due')
  })

  it('renders a negative weekly delta with its sign', () => {
    const rendered = renderTemplate(digestTemplate, {
      ...payload,
      enrollments: [
        {
          certName: 'AWS Security Specialty',
          calibrated: true,
          readiness: 72,
          delta: -5,
          weakestDomain: 'Security',
          dueReviewCount: 3,
        },
      ],
    })

    expect(rendered.text).toMatch(/-5% from last week/)
    expect(rendered.html).toMatch(/-5% from last week/)
  })

  it('renders the uncalibrated keep-going section with no numeric score or delta', () => {
    const rendered = renderTemplate(digestTemplate, {
      ...payload,
      enrollments: [{ certName: 'Azure Fundamentals', calibrated: false }],
    })

    expect(rendered.text).toMatch(/keep going/i)
    expect(rendered.text).not.toMatch(/\d+%/)
    expect(rendered.text).not.toMatch(/from last week/)
    expect(rendered.html).toMatch(/keep going/i)
    expect(rendered.html).not.toMatch(/\d+%/)
  })

  it('omits the delta phrase when a calibrated section has no prior snapshot', () => {
    const rendered = renderTemplate(digestTemplate, {
      ...payload,
      enrollments: [
        {
          certName: 'AWS Security Specialty',
          calibrated: true,
          readiness: 72,
          delta: null,
          weakestDomain: 'Security',
          dueReviewCount: 0,
        },
      ],
    })

    expect(rendered.text).toContain('72%')
    expect(rendered.text).not.toMatch(/from last week/)
    expect(rendered.html).not.toMatch(/from last week/)
  })

  it('includes the unsubscribe link', () => {
    const rendered = renderTemplate(digestTemplate, payload)

    expect(rendered.text).toContain(payload.unsubscribeUrl)
    expect(rendered.html).toContain(payload.unsubscribeUrl)
  })

  it('escapes interpolated payload values in HTML', () => {
    const rendered = renderTemplate(digestTemplate, {
      productName: 'Readion & Friends',
      unsubscribeUrl: 'https://readion.app/u?token=a&b="c"',
      enrollments: [
        {
          certName: '<script>alert("x")</script>',
          calibrated: true,
          readiness: 50,
          delta: 1,
          weakestDomain: '<b>Security</b>',
          dueReviewCount: 1,
        },
      ],
    })

    expect(rendered.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(rendered.html).toContain('Readion &amp; Friends')
    expect(rendered.html).not.toContain('<script>alert')
  })
})
