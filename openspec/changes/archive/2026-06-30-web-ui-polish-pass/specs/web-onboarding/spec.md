## MODIFIED Requirements

### Requirement: Certification selection step

The onboarding cert-select step SHALL list the certifications returned by `GET /certifications` (live certs only, as the API already filters by `state: "live"`), showing each certification's name and provider, and SHALL let the user select exactly one to continue.

The step SHALL render a certification **search box** above the list (matching `openspec/design/Onboarding.html` step 1). Typing in the search box SHALL filter the already-loaded catalog client-side — no additional request is issued — matching against each certification's name, provider, and code (case-insensitive). When the query matches no certification the list SHALL show an empty result rather than the full catalog. Clearing the query SHALL restore the full list.

#### Scenario: User selects a certification

- **WHEN** the cert-select step renders with certifications from `GET /certifications`
- **THEN** each option displays the certification `name` and `provider`
- **WHEN** the user selects one certification and advances
- **THEN** the chosen `certificationId` is carried into the default-preferences step

#### Scenario: Continue is disabled until a certification is chosen

- **WHEN** no certification is selected
- **THEN** the control to advance to the preferences step is disabled

#### Scenario: Search filters the catalog client-side

- **WHEN** the user types a query into the cert search box
- **THEN** only certifications whose name, provider, or code matches the query (case-insensitive) remain visible
- **THEN** no additional `GET /certifications` request is issued to perform the filtering
- **WHEN** the user clears the query
- **THEN** the full live-cert list is shown again

## ADDED Requirements

### Requirement: Onboarding presents as a standalone flow without the global app chrome

The `/onboarding` route SHALL present as a standalone setup flow that HIDES the global application chrome — specifically the persistent left sidebar of the default app shell. Because the shell's default layout is applied to any page that declares no explicit layout, the onboarding page MUST opt out of that default by assigning a bare/standalone layout via `definePageMeta({ layout })` (the minimal/auth-style layout), so the global navigation sidebar does not wrap the onboarding wizard. The onboarding flow keeps its own internal step rail (the Setup wizard sidebar from `openspec/design/Onboarding.html`); only the global app shell is suppressed.

#### Scenario: Onboarding route does not render the global app sidebar

- **WHEN** an authenticated user in onboarding loads `/onboarding`
- **THEN** the page renders without the default app shell's persistent global navigation sidebar wrapping it
- **THEN** the onboarding wizard (its own setup step rail and content) is shown as a standalone flow

#### Scenario: Onboarding page opts out of the default shell layout

- **WHEN** the onboarding page component is evaluated
- **THEN** it declares an explicit bare/standalone layout via `definePageMeta({ layout })` rather than inheriting the default sidebar shell
