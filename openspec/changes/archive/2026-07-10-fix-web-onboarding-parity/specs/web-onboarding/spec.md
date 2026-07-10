## MODIFIED Requirements

### Requirement: Certification selection step

The onboarding cert-select step SHALL list the certifications returned by `GET /certifications` (live certs only, as the API already filters by `state: "live"`), and SHALL let the user select exactly one to continue.

The list SHALL be **grouped by provider/vendor** (matching `openspec/design/Onboarding.html` step 1): certifications are bucketed under an uppercase vendor group header (e.g. "Amazon Web Services", "Google Cloud", "Microsoft Azure"), and each row shows the certification `name` and a `code` badge — the provider is conveyed by the group header rather than repeated inline on each row. Groups render in a stable order, and a group with no rows matching the active search is hidden.

The step SHALL render a certification **search box** above the list with a leading magnifying-glass icon and a right-aligned "N available" count suffix reflecting the total number of loaded certifications. Typing in the search box SHALL filter the already-loaded catalog client-side — no additional request is issued — matching against each certification's name, provider, and code (case-insensitive). When the query matches no certification the list SHALL show an empty result rather than the full catalog; clearing the query SHALL restore the full grouped list.

The step footer SHALL present the Continue action separated from the list by a top-border divider with the design's spacing, right-aligned, labeled "Continue →". Continue SHALL remain disabled until a certification is selected.

#### Scenario: Certs are grouped by vendor

- **WHEN** the cert-select step renders with certifications from `GET /certifications`
- **THEN** certifications are grouped under uppercase vendor/provider headers
- **THEN** each row shows the certification name and a code badge, with the provider shown as the group header (not repeated per row)

#### Scenario: User selects a certification

- **WHEN** the user selects one certification and advances
- **THEN** the chosen `certificationId` is carried into the default-preferences step

#### Scenario: Continue is disabled until a certification is chosen

- **WHEN** no certification is selected
- **THEN** the footer Continue action (labeled "Continue →", separated by a top-border divider) is disabled

#### Scenario: Search filters the catalog client-side across groups

- **WHEN** the user types a query into the cert search box
- **THEN** only certifications whose name, provider, or code matches the query (case-insensitive) remain visible, and groups with no remaining rows are hidden
- **THEN** no additional `GET /certifications` request is issued to perform the filtering
- **WHEN** the user clears the query
- **THEN** the full grouped live-cert list is shown again

#### Scenario: Search box shows a count and icon

- **WHEN** the cert-select step renders
- **THEN** the search box shows a leading magnifying-glass icon and a right-aligned "N available" suffix reflecting the total loaded certification count
