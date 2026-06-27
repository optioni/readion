// Minimal `vitest` stand-in for the Playwright e2e harness. The shared-container
// helpers in `@readion/db` call `inject('readion*Url')`; returning undefined makes
// them start their own Testcontainers instances instead of reusing a Vitest-managed
// shared pair. No other Vitest API is reachable from the harness require chain.
module.exports = {
  inject: () => undefined,
}
