import { generateRobotsTxt } from '@nuxtjs/robots/util'
import { PUBLIC_AUTH_ROUTES } from '../../app/constants/publicRoutes'

// @nuxtjs/robots treats a wildcard `Disallow: /` group as "site not indexable" and, in that
// state, ignores every configured `allow` rule in favour of a hardcoded blanket disallow (see
// getSiteRobotConfig.js in the module). That collides with this app's defensive posture: the
// whole app is disallowed EXCEPT the public auth routes, which must stay crawlable so
// link-unfurl bots (Slackbot, Twitterbot) can render share cards. Overriding the final
// robots.txt text here keeps the module's route/SSR/dev-preview wiring (the reason it was
// adopted, per design.md) while producing the exact rule set the `robots` block in
// nuxt.config.ts already declares — module config and this override must be kept in sync.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('robots:robots-txt', (ctx) => {
    ctx.robotsTxt = generateRobotsTxt({
      groups: [
        {
          userAgent: ['*'],
          allow: [...PUBLIC_AUTH_ROUTES],
          disallow: ['/'],
        },
      ],
      sitemaps: [],
    })
  })
})
