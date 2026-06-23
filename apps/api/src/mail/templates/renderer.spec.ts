import { describe, expect, it } from 'vitest'
import { type FoundationalTemplatePayload, foundationalTemplate } from './registry'
import { renderTemplate } from './renderer'

const payload = {
  name: 'Ava Learner',
  productName: 'Readion',
  actionUrl: 'https://readion.app/study',
} satisfies FoundationalTemplatePayload

describe('mail template renderer', () => {
  it('renders subject, text, and HTML for the foundational template', () => {
    const rendered = renderTemplate(foundationalTemplate, payload)

    expect(rendered.subject).toBeTruthy()
    expect(rendered.text).toBeTruthy()
    expect(rendered.html).toBeTruthy()
  })

  it('includes every referenced payload field in text and HTML', () => {
    const rendered = renderTemplate(foundationalTemplate, payload)

    for (const value of Object.values(payload)) {
      expect(rendered.text).toContain(value)
      expect(rendered.html).toContain(value)
    }
  })

  it('wraps HTML in the shared base layout', () => {
    const rendered = renderTemplate(foundationalTemplate, payload)

    expect(rendered.html).toMatch(/^<!doctype html>/i)
    expect(rendered.html).toContain('<html')
    expect(rendered.html).toContain('</html>')
    expect(rendered.html).toContain('<body')
    expect(rendered.html).toContain('</body>')
  })

  it('renders without transport side effects', () => {
    const transport = {
      sendMail: () => {
        throw new Error('renderer must not send mail')
      },
    }

    expect(() => renderTemplate(foundationalTemplate, payload)).not.toThrow()
    expect(transport).toBeDefined()
  })

  it('escapes foundational template payload values in HTML content and attributes', () => {
    const rendered = renderTemplate(foundationalTemplate, {
      name: '<script>alert("x")</script>',
      productName: 'Readion & Friends',
      actionUrl: 'https://readion.app/study?next=<script>&name="Ava"',
    })

    expect(rendered.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(rendered.html).toContain('Readion &amp; Friends')
    expect(rendered.html).toContain(
      'href="https://readion.app/study?next=&lt;script&gt;&amp;name=&quot;Ava&quot;"',
    )
    expect(rendered.html).not.toContain('<script>alert')
  })
})
