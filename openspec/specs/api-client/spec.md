## Purpose

Specifies the runtime API client layer for the Nuxt web app: how the API base URL is configured, how Orval-generated composables are wired into Vue Query, how the custom fetch mutator handles credentials and structured errors, and how SSE streaming endpoints are consumed.

## Requirements

### Requirement: Environment-driven API base URL

The web app SHALL read the API base URL from `runtimeConfig.public.apiBaseUrl`, sourced from `NUXT_PUBLIC_API_BASE_URL`. The base URL MUST NOT be hardcoded in client code, so the same build runs against different environments.

#### Scenario: Base URL resolves from public runtime config

- **WHEN** a unit test reads the runtime config of the configured Nuxt app
- **THEN** `runtimeConfig.public.apiBaseUrl` equals the value of `NUXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:3001/api/v1` from `.env.example`)

### Requirement: Vue Query plugin

The web app SHALL register a `@tanstack/vue-query` plugin that provides a single shared `QueryClient` to the Vue app, so the Orval-generated composables (`useQuery`/`useMutation`) work in any component.

#### Scenario: VueQuery provides a QueryClient to components

- **WHEN** a component test mounts a component that calls a generated `useQuery` composable within the app context
- **THEN** the composable resolves against an injected `QueryClient` (no "no QueryClient found" injection error is thrown)

#### Scenario: A single shared QueryClient is reused

- **WHEN** the Vue Query plugin is initialized
- **THEN** it installs exactly one `QueryClient` instance shared across the app rather than constructing a new client per composable call

### Requirement: Credentialed fetch mutator for the generated client

The Orval-generated client SHALL route every request through a custom fetch mutator that prefixes `runtimeConfig.public.apiBaseUrl` and sends `credentials: 'include'`, so the `httpOnly` refresh-token cookie and CORS-credentialed requests function. The Orval codegen pipeline (`orval.config.ts`, `yarn codegen`) is owned by `api-foundation`; this change only configures the runtime mutator it calls.

#### Scenario: Requests are sent with credentials and the configured base URL

- **WHEN** a generated client method is invoked in a test with a mocked fetch
- **THEN** the request URL begins with `runtimeConfig.public.apiBaseUrl`
- **THEN** the request is issued with `credentials: 'include'`

#### Scenario: Mutator targets the committed generated client directory

- **WHEN** the Orval output configuration is inspected
- **THEN** it is configured to use the custom mutator for the client generated into `apps/web/src/api/`

### Requirement: Typed problem-details errors

The fetch mutator SHALL surface non-2xx responses as a typed error carrying the RFC 7807 problem-details fields (`type`, `title`, `status`, `detail`, `errors`), so callers can read structured error data rather than parsing raw responses.

#### Scenario: A 422 problem-details response becomes a typed error

- **WHEN** the API returns a 422 with an `application/problem+json` body `{ type, title, status: 422, detail, errors }`
- **THEN** the mutator rejects with an error exposing `status === 422` and the `title`, `detail`, and `errors` fields from the body

### Requirement: SSE composable for streaming endpoints

The web app SHALL provide a composable that wraps the native `useEventSource` to consume the API's Server-Sent-Events endpoints. It MUST expose reactive connection state and the latest received message data, and MUST close the connection when the consuming component unmounts.

#### Scenario: Composable connects and exposes received events

- **WHEN** a component using the SSE composable mounts against a test SSE source that emits two `message` events
- **THEN** the composable's reactive data reflects the most recent emitted event payload and its status reports an open connection

#### Scenario: Connection closes on unmount

- **WHEN** the component consuming the SSE composable is unmounted
- **THEN** the underlying `EventSource` is closed (no further events are processed)
