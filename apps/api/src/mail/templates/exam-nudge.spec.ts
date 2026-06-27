import { describe, expect, it } from 'vitest'
import { type ExamNudgeTemplatePayload, examNudgeTemplate } from './registry'
import { renderTemplate } from './renderer'

const payload = {
  productName: 'Readion',
  certName: 'AWS Cloud Practitioner',
  surveyUrl: 'https://readion.app/exam-outcome?token=abc',
} satisfies ExamNudgeTemplatePayload

describe('exam-nudge template', () => {
  it('renders a non-empty subject, text, and HTML wrapped in the base layout', () => {
    const rendered = renderTemplate(examNudgeTemplate, payload)

    expect(rendered.subject).toBeTruthy()
    expect(rendered.text).toBeTruthy()
    expect(rendered.html).toMatch(/^<!doctype html>/i)
    expect(rendered.html).toContain('<html')
    expect(rendered.html).toContain('</html>')
  })

  it('asks the one-tap exam-outcome survey question with all three options', () => {
    const rendered = renderTemplate(examNudgeTemplate, payload)

    expect(rendered.text).toMatch(/did you take the exam yet/i)
    expect(rendered.text).toMatch(/passed/i)
    expect(rendered.text).toMatch(/didn't pass/i)
    expect(rendered.text).toMatch(/not yet/i)
    expect(rendered.html).toMatch(/passed/i)
  })

  it('matches the acceptance contract regexes on subject+text and text+html', () => {
    const rendered = renderTemplate(examNudgeTemplate, payload)
    expect(`${rendered.subject} ${rendered.text}`).toMatch(/exam|passed|survey|outcome/i)
    expect(`${rendered.text} ${rendered.html}`).toMatch(/passed/i)
  })

  it('escapes interpolated payload values in HTML', () => {
    const rendered = renderTemplate(examNudgeTemplate, {
      productName: 'Readion & Friends',
      certName: '<script>alert("x")</script>',
      surveyUrl: 'https://readion.app/o?next=<script>&name="Ava"',
    })

    expect(rendered.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(rendered.html).toContain('Readion &amp; Friends')
    expect(rendered.html).not.toContain('<script>alert')
  })

  it('renders without a surveyUrl', () => {
    const rendered = renderTemplate(examNudgeTemplate, {
      productName: 'Readion',
      certName: 'AWS Cloud Practitioner',
    })

    expect(rendered.text).toMatch(/passed/i)
    expect(rendered.html).toContain('<html')
  })
})
