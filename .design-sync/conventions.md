# Readion Design Conventions

Readion is a dark-mode-first certification exam prep app. The design language is minimal and low-noise — background surfaces carry the hierarchy, not decorative elements.

## Applying tokens

All design values are CSS custom properties. Apply them via inline `style` or a `<style>` block:

```jsx
<div style={{
  background: "var(--readion-background-surface)",
  color: "var(--readion-text-primary)",
  padding: "24px",
  borderRadius: "8px",
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
| Primary muted | `--readion-primary-muted` | `#1e40af` |
| Primary subtle | `--readion-primary-subtle` | `#334155` |
| Accent label | `--readion-accent-label` | `#7c8cf8` |
| Accent label muted | `--readion-accent-label-muted` | `#93c5fd` |
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

## Spacing and shape

The app uses standard Tailwind spacing. For inline styles in React, match these values: 4px (tight), 8px (small), 12px (medium), 16px (base), 24px (large), 32px (xl). Border-radius values: 3px (sm), 6px (md), 8px (lg), 12px (xl), 9999px (pill).

## Typography

Font family: Inter (falls back to `ui-sans-serif, system-ui`). Set via `font-family: Inter, ui-sans-serif, system-ui`. Sizes: 11px (label/caps, `letter-spacing: 0.1em; text-transform: uppercase`), 14px (body default), 20px (heading), 28px (score/hero number).

## Idiomatic example — quiz option card

```jsx
<div style={{
  background: "var(--readion-background-surface)",
  color: "var(--readion-text-secondary)",
  border: "1px solid var(--readion-border-default)",
  borderRadius: "3px",
  padding: "8px",
  fontSize: "14px",
  lineHeight: "1.5",
  fontFamily: "Inter, ui-sans-serif, system-ui",
}}>
  Option text
</div>
```

Selected state: swap `background` to `var(--readion-primary)` and `color` to `#ffffff`.
