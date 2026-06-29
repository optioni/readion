## MODIFIED Requirements

### Requirement: Notifications tab digest preference

The `web-settings` Notifications tab SHALL render the weekly-digest preference as a real two-way switch bound to the profile contract: seeded from `GET /users/me`'s `digestOptOut`, and toggling it issues `PATCH /users/me { digestOptOut }` and reflects the new state. This replaces the prior informational-only treatment that issued no request. The tab MAY still mention the one-click unsubscribe link in the digest email.

#### Scenario: Toggle digest from Settings

- **WHEN** the user flips the weekly-digest switch in the Notifications tab
- **THEN** a `PATCH /users/me { digestOptOut }` is sent with the new value and the switch reflects the persisted state after the response
