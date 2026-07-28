## Why

The AI SDK majors are one version behind: `ai` 6.0.209 → 7.0.40, `@ai-sdk/anthropic` 3.0.103 → 4.0.23, `@ai-sdk/openai` 3.0.74 → 4.0.22.

Falling behind on these packages has already cost us once. `@ai-sdk/anthropic@3.0.85` predated `claude-sonnet-5`, so `getModelCapabilities` fell through to its unknown-model default with `supportsStructuredOutput: false`. Object generation silently degraded from a server-enforced `output_format` to a non-strict `json` tool call, which let the model return well-formed JSON that failed client-side validation. That surfaced as "0 candidate sources" in cert setup for CLF-C02 despite 16 healthy search results, and it affected all five `claude-sonnet-5` task types, not just discovery. A patch bump to 3.0.103 fixed it (commit `93be14e`), but the episode shows that provider-capability tables are load-bearing and drift is expensive.

This change is maintenance, not a bug fix — the production defect is already resolved. The motivation is staying on a supported major, getting the stabilised v7 API surface, and paying the CommonJS→ESM cost deliberately rather than under time pressure during the next incident.

## What Changes

**Module system (the dominant cost).** AI SDK 7 is ESM-only and drops CommonJS entirely. Both `apps/api` and `apps/worker` compile with `"module": "commonjs"` (`apps/api/tsconfig.json:5`, `apps/worker/tsconfig.json:5`). For NestJS this is not a config toggle — it interacts with decorator emit and `reflect-metadata`, MikroORM entity discovery, the SWC transform, and the Vitest setup. This is the bulk of the work and the main source of risk.

**System prompt option rename.** v7 renames `system` to `instructions` across `generateText`, `streamText`, and `generateObject`. Seven call sites: `apps/api/src/llm/llm.service.ts:69,111,153`, `apps/api/src/cert-setup/cert-discovery.service.ts:99,136`, `apps/api/src/agent/tools/agent-tools.factory.ts:121,175`. Mechanical, but it changes the `LlmService` option surface that every caller depends on.

**System messages in `messages` are rejected by default.** v7 requires system content to move to the top-level `instructions` option. Two sites construct `role: 'system'` entries into the array: `apps/api/src/agent/system-prompt.builder.ts:62` and `apps/api/src/agent/agent-message.serializer.ts:31`. The serializer reconstructs persisted `AgentConversation` JSONB rows for replay, so this touches stored data, not only code — existing conversations containing system rows must still resume correctly. This interacts with the prompt-caching layering in `agent-chat`, where cache-control is applied to the stable system prefix.

**Phantom dependencies.** `apps/worker` imports `ai`, `@ai-sdk/anthropic`, and `@ai-sdk/openai` (`apps/worker/src/llm/llm.service.ts:1,2,6`, `apps/worker/src/sessions/session-item-generator.service.ts:5`) without declaring any of them, resolving instead via hoisting from `apps/api`. The upgrade must not rely on that; the worker should declare its own dependencies.

**Provider spec bump.** `@ai-sdk/provider` moves 3.x → 4.x, changing the `LanguageModelV3` interface the provider adapter is typed against (`apps/api/src/llm/provider-adapter.ts`).

Already satisfied, no work required: Node 24.18 clears the v7 `>=22` floor; the codebase uses the stable `output` option rather than `experimental_output`; `ToolCallOptions` (renamed to `ToolExecutionOptions`) is not imported anywhere.

## Capabilities

### New Capabilities

None. This change modifies existing behaviour and infrastructure only.

### Modified Capabilities

- `llm-gateway`: the gateway's call surface changes as `system` becomes `instructions` across all three generation methods, and the prompt-caching helper must apply cache-control through the new instructions path rather than a system message.
- `agent-chat`: replayed conversation history may no longer carry `role: 'system'` entries; the in-session system prompt must be supplied as top-level instructions while preserving the stable-prefix layering that prompt caching depends on, including for conversations already persisted with system rows.
- `monorepo-workspace`: the NestJS apps' TypeScript module output moves from CommonJS to ESM, which the workspace requirement on SWC-based compilation must reflect.

## Impact

**Code**: `apps/api/src/llm/` (gateway, provider adapter, prompt-cache helper), `apps/api/src/agent/` (system prompt builder, message serializer, tools factory), `apps/api/src/cert-setup/cert-discovery.service.ts`, `apps/worker/src/llm/`, `apps/worker/src/sessions/`.

**Build/config**: `apps/api/tsconfig.json`, `apps/worker/tsconfig.json`, SWC config, Vitest config for both apps, `apps/api/package.json`, `apps/worker/package.json`, `yarn.lock`.

**Data**: persisted `AgentConversation` JSONB message arrays containing `role: 'system'` rows must continue to replay correctly after the change.

**Risk**: the ESM migration is the high-risk element and is independently testable before any SDK API changes land. Deployment is via existing container images; no Kubernetes manifest or environment variable changes are expected.

**Out of scope**: model ID changes, the `claude-sonnet-5` capability fix (already shipped in `93be14e`), and the discovery salvage logic (already shipped in `059ed94`).
