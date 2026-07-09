export const SITE_NAME = 'Readion'
export const DEFAULT_PAGE_TITLE = 'App'
// String form (not a function) so it survives nuxt.config's app.head serialization into the
// client/server build — a titleTemplate function set via nuxt.config is silently dropped there.
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`
export const SITE_DESCRIPTION =
  'Readion — personalized certification exam preparation and study tracking.'
export const DEFAULT_TWITTER_CARD = 'summary' as const

export const buildTitle = (pageTitle?: string): string => {
  const chunk = pageTitle && pageTitle.length > 0 ? pageTitle : DEFAULT_PAGE_TITLE
  return TITLE_TEMPLATE.replace('%s', chunk)
}

export type PageSeoMeta = {
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogSiteName: string
  twitterCard: typeof DEFAULT_TWITTER_CARD
}

// Shared Open Graph / Twitter defaults so per-page callers only decide title + description —
// used by the public auth pages so a pasted /login or /register link unfurls into a product
// card instead of a bare URL.
export const buildPageSeoMeta = (page: { title: string; description: string }): PageSeoMeta => ({
  title: page.title,
  description: page.description,
  ogTitle: page.title,
  ogDescription: page.description,
  ogSiteName: SITE_NAME,
  twitterCard: DEFAULT_TWITTER_CARD,
})
