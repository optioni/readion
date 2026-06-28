import MarkdownIt from 'markdown-it'

// `html: false` makes markdown-it escape any embedded raw HTML instead of passing it through, and the
// default `validateLink` rejects javascript:/vbscript:/file: URLs — together this keeps the rendered
// output safe to bind with v-html without a separate sanitiser.
const md = new MarkdownIt({ html: false, linkify: true })

export function renderMarkdown(source: string): string {
  return md.render(source ?? '')
}
