const HTML_ESCAPE_PATTERN = /[&<>"']/g
const HTML_ESCAPE_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
} as const

export function escapeHtml(value: string) {
  return value.replace(
    HTML_ESCAPE_PATTERN,
    (character) => HTML_ESCAPE_REPLACEMENTS[character as keyof typeof HTML_ESCAPE_REPLACEMENTS],
  )
}
