# Readion design-sync notes

## Setup

- **Tokens-only sync** — this is a Vue 3 / Nuxt 4 app, not React. The design-sync skill requires React for component previews; only CSS design tokens were synced.
- Stub entry: `.design-sync/stub.mjs` (`export {};`) — required by the converter even for tokens-only mode.
- React installed into `.ds-sync/node_modules` (not the project's node_modules) — required by the converter to vendor React for the preview runtime.
- `--node-modules .ds-sync/node_modules` must be passed on every rebuild.

## Re-sync command

```sh
node .ds-sync/resync.mjs \
  --config .design-sync/config.json \
  --node-modules .ds-sync/node_modules \
  --entry .design-sync/stub.mjs \
  --out ./ds-bundle \
  --remote .design-sync/.cache/remote-sync.json
```

Then upload per the atomic path (pinned re-sync).

## Token source of truth

`apps/web/app/assets/css/main.css` was migrated to Tailwind v4 `@theme` syntax — it no longer holds the full token set as `:root` CSS variables. The canonical design token source is now `apps/web/app/design/tokens.ts`. When tokens change, update `.design-sync/tokens.css` to match `tokens.ts` (not `main.css`), then re-sync.

## Re-sync risks

- **Token drift** — `.design-sync/tokens.css` must be kept in sync with `apps/web/app/design/tokens.ts`. The app uses Tailwind utilities for most styling, so CSS variable usage in Vue files is minimal — diff `tokens.ts` against `tokens.css` to spot drift.
- **No component previews** — there is nothing to re-verify on the component side. Future re-syncs are purely CSS token updates.
- **Inter font** — referenced in the CSS but not shipped (marked as `runtimeFontPrefixes`). The app relies on system fonts / host environment providing Inter. Acceptable.
