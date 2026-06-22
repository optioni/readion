# Readion design-sync notes

## Setup

- **Tokens-only sync** — this is a Vue 3 / Nuxt 4 app, not React. The design-sync skill requires React for component previews; only CSS design tokens were synced.
- Stub entry: `.design-sync/stub.mjs` (`export {};`) — required by the converter even for tokens-only mode.
- React installed into `.ds-sync/node_modules` (not the project's node_modules) — required by the converter to vendor React for the preview runtime.
- `--node-modules .ds-sync/node_modules` must be passed on every rebuild.

## Re-sync command

```sh
node .ds-sync/package-build.mjs \
  --config .design-sync/config.json \
  --node-modules .ds-sync/node_modules \
  --entry .design-sync/stub.mjs \
  --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

Then upload per the incremental/atomic path as appropriate.

## Re-sync risks

- **Token drift** — `.design-sync/tokens.css` is a hand-extracted copy of the values from `apps/web/app/assets/css/main.css`. If tokens change in `main.css`, they must be manually updated in `tokens.css` and a re-sync run.
- **No component previews** — there is nothing to re-verify on the component side. Future re-syncs are purely CSS token updates.
- **Inter font** — referenced in the CSS but not shipped (marked as `runtimeFontPrefixes`). The app relies on system fonts / host environment providing Inter. Acceptable; recorded in NOTES.md per skill requirement.
