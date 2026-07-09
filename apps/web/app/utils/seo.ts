export const SITE_NAME = 'Readion'
export const DEFAULT_PAGE_TITLE = 'App'
// String form (not a function) so it survives nuxt.config's app.head serialization into the
// client/server build — a titleTemplate function set via nuxt.config is silently dropped there.
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`
export const SITE_DESCRIPTION =
  'Readion — personalized certification exam preparation and study tracking.'
export const DEFAULT_TWITTER_CARD = 'summary'

export const buildTitle = (pageTitle?: string): string => {
  const chunk = pageTitle && pageTitle.length > 0 ? pageTitle : DEFAULT_PAGE_TITLE
  return TITLE_TEMPLATE.replace('%s', chunk)
}
