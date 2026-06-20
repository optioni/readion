## Purpose

RFC 7807 Problem Details types, field-level validation error types, and an error type slug registry, exported from the shared package for consistent error shaping across the API.

## Requirements

### Requirement: RFC 7807 Problem Details type

The shared package SHALL export a `ProblemDetails` type conforming to RFC 7807 with fields `type: string`, `title: string`, `status: number`, `detail: string`, and an optional `errors` array of field-level entries.

#### Scenario: Minimal problem details value

- **WHEN** a value `{ type: '/errors/not-found', title: 'Not Found', status: 404, detail: 'Certification abc does not exist' }` is typed as `ProblemDetails`
- **THEN** the type-check passes with no `errors` array present

#### Scenario: Problem details with field errors

- **WHEN** a value adds `errors: [{ field: 'email', message: 'Email is already taken' }]` to a `ProblemDetails` with `status: 422`
- **THEN** the type-check passes and `errors[0].field` is typed as `string`, `errors[0].message` as `string`

### Requirement: Field-level validation error item

The shared package SHALL export the validation error item type used in the `errors` array, with at least a `field: string` and a `message: string`.

#### Scenario: Field error shape

- **WHEN** a value `{ field: 'password', message: 'Must be at least 12 characters' }` is typed as the validation error item
- **THEN** the type-check passes

### Requirement: Error type slug registry

The shared package SHALL export a const-asserted `ERROR_TYPES` registry mapping named keys to `/errors/...` slug strings, so error `type` values are referenced by name rather than ad-hoc literals. It MUST include at least a validation-error slug equal to `/errors/validation-error`.

#### Scenario: Validation error slug resolves

- **WHEN** `ERROR_TYPES.VALIDATION` is read
- **THEN** its value is exactly `/errors/validation-error`

#### Scenario: Registry is const-asserted

- **WHEN** the registry's slug values are inspected by the type checker
- **THEN** each value is a string-literal type (not widened to `string`), so misspelled references fail to type-check
