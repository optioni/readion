## ADDED Requirements

### Requirement: Authentication is required by default via a global guard

The system SHALL register a global `JwtAuthGuard` that protects every route by default, requiring a valid access token. Routes that must be reachable without authentication MUST opt out explicitly with a `@Public()` decorator. An unauthenticated request to a non-public route MUST return `401`.

#### Scenario: Unauthenticated request to a protected route is rejected

- **WHEN** a request without a valid access token hits a route that has no `@Public()` decorator
- **THEN** the response is `401` RFC 7807 and the controller body never runs

#### Scenario: Public routes are reachable without a token

- **WHEN** an unauthenticated request hits `/api/v1/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, or `GET /health`
- **THEN** the request is allowed through without an access token

#### Scenario: Authenticated request exposes the principal

- **WHEN** a request with a valid access token reaches a protected handler
- **THEN** the request principal exposes the authenticated user's `id` and `role`

### Requirement: Two roles exist and default to user

The system SHALL define exactly two roles, `user` and `admin`, as an enum on the `User` entity, defaulting new accounts to `user` (except the first-registered admin). The `Role` enum/constants SHALL be exported from `packages/shared` for reuse across apps.

#### Scenario: Default role is user

- **WHEN** a non-first user registers
- **THEN** the persisted `role` is `user`

#### Scenario: Role is exposed in the access token

- **WHEN** any user authenticates
- **THEN** their access token carries their current `role` as a claim

### Requirement: Admin-only routes are protected by RolesGuard

The system SHALL provide a `RolesGuard` and a `@Roles()` decorator so a route can require `admin`. A `user`-role principal hitting an `@Roles('admin')` route MUST receive `403`; an `admin` principal MUST be allowed.

#### Scenario: Non-admin is forbidden from an admin route

- **WHEN** an authenticated `user`-role principal requests a route annotated `@Roles('admin')`
- **THEN** the response is `403` RFC 7807

#### Scenario: Admin is permitted

- **WHEN** an authenticated `admin`-role principal requests the same route
- **THEN** the request is authorized and proceeds

#### Scenario: RolesGuard requires authentication first

- **WHEN** an unauthenticated request hits an `@Roles('admin')` route
- **THEN** the response is `401` (authentication is evaluated before role)

### Requirement: User-scoped resources are owned at the repository layer

The system SHALL provide a repository-layer ownership-scoping convention so that queries for user-scoped resources are always filtered by the authenticated `userId` within the same query (rather than fetch-then-check). Accessing a resource that exists but belongs to another user MUST return `404`, not `403`, so the existence of others' resources is not leaked.

#### Scenario: Owner can read their own resource

- **WHEN** an authenticated user requests a user-scoped resource that belongs to them
- **THEN** the resource is returned in the standard envelope

#### Scenario: Cross-user access returns 404

- **WHEN** an authenticated user requests a user-scoped resource that exists but belongs to a different user
- **THEN** the response is `404` RFC 7807, identical to the response for a resource that does not exist at all

#### Scenario: Ownership is enforced in a single scoped query

- **WHEN** a user-scoped resource is fetched through the convention
- **THEN** the database query filters by `userId` as part of the lookup (no separate row-then-ownership check)
