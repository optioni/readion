import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '~/composables/renderMarkdown'

describe('renderMarkdown', () => {
  it('renders headings', () => {
    expect(renderMarkdown('## Title')).toContain('<h2>Title</h2>')
  })

  it('renders unordered lists', () => {
    const html = renderMarkdown('- one\n- two')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<li>two</li>')
  })

  it('renders inline emphasis', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>')
  })

  it('does not emit raw script tags from embedded HTML', () => {
    const html = renderMarkdown('Hi <script>alert(1)</script>')
    expect(html).not.toContain('<script>')
  })

  it('never emits a javascript: href', () => {
    const html = renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toMatch(/href="javascript:/)
    expect(html).not.toContain('<a ')
  })

  it('renders safe http links as anchors', () => {
    const html = renderMarkdown('[docs](https://aws.amazon.com)')
    expect(html).toContain('href="https://aws.amazon.com"')
  })
})
