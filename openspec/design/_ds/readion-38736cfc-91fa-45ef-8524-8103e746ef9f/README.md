# Readion Design Conventions

Readion is a dark-mode-first certification exam prep app. The design language is minimal and low-noise — background surfaces carry the hierarchy, not decorative elements.

## Applying tokens

All design values are CSS custom properties. Apply them via inline `style` or a `<style>` block:

```jsx
<div style={{
  background: "var(--readion-background-surface)",
  color: "var(--readion-text-primary)",
  padding: "var(--readion-spacing-xl)",
  borderRadius: "var(--readion-rounded-lg)",
}}>
  Content
</div>
```

## Colour vocabulary

| Role | Token | Value |
|---|---|---|
| Page background | `--readion-background-base` | `#0f172a` |
| Card / panel | `--readion-background-surface` | `#1e293b` |
| Elevated surface | `--readion-background-elevated` | `#0a0f1e` |
| Overlay / modal bg | `--readion-background-overlay` | `#16213e` |
| Primary action | `--readion-primary` | `#1d4ed8` |
| Primary hover | `--readion-primary-hover` | `#1e40af` |
| Accent label | `--readion-accent-label` | `#7c8cf8` |
| Body text | `--readion-text-primary` | `#e2e8f0` |
| Secondary text | `--readion-text-secondary` | `#94a3b8` |
| Muted / meta text | `--readion-text-muted` | `#64748b` |
| Subtle / placeholder | `--readion-text-subtle` | `#475569` |
| Default border | `--readion-border-default` | `#1e293b` |
| Strong border | `--readion-border-strong` | `#334155` |
| Readiness: poor | `--readion-status-poor` | `#f87171` |
| Readiness: warning | `--readion-status-warning` | `#fb923c` |
| Readiness: medium | `--readion-status-medium` | `#fbbf24` |
| Readiness: good | `--readion-status-good` | `#34d399` |

## Spacing

`--readion-spacing-xs` (4px) · `--readion-spacing-sm` (8px) · `--readion-spacing-md` (12px) · `--readion-spacing-lg` (16px) · `--readion-spacing-xl` (24px)

## Border radius

`--readion-rounded-sm` (3px) · `--readion-rounded-md` (6px) · `--readion-rounded-lg` (8px) · `--readion-rounded-xl` (12px) · `--readion-rounded-full` (9999px)

## Typography

Font family: Inter (falls back to `ui-sans-serif, system-ui`). Font sizes: `--readion-font-size-base` (14px), `--readion-font-size-heading` (20px), `--readion-font-size-label` (11px, uppercase `--readion-letter-spacing-label` 0.1em), `--readion-font-size-score` (28px bold for readiness scores).

## Idiomatic example — quiz option card

```jsx
<div style={{
  background: "var(--readion-background-base)",
  color: "var(--readion-text-secondary)",
  border: "1px solid var(--readion-border-default)",
  borderRadius: "var(--readion-rounded-sm)",
  padding: "var(--readion-spacing-sm)",
  fontSize: "var(--readion-font-size-base)",
  lineHeight: "var(--readion-line-height-base)",
}}>
  Option text
</div>
```

Selected state: swap `background` to `var(--readion-primary)` and `color` to `#ffffff`.

# ReadionTokens (@readion/tokens@0.0.0)

This design system is the published @readion/tokens React library, bundled as a single
browser global. All 0 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.ReadionTokens`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.ReadionTokens.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Component } = window.ReadionTokens;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Component />);
```

## Tokens

50 CSS custom properties from @readion/tokens. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (7): `--readion-background-surface`, `--readion-text-primary`, `--readion-text-secondary`, …
- **typography** (10): `--readion-font-sans`, `--readion-font-mono`, `--readion-font-size-base`, …
- **radius** (5): `--readion-rounded-sm`, `--readion-rounded-md`, `--readion-rounded-lg`, …
- **other** (28): `--readion-background-base`, `--readion-background-elevated`, `--readion-background-overlay`, …

## Components


