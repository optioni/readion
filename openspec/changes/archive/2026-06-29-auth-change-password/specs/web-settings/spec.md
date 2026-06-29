## MODIFIED Requirements

### Requirement: Account tab password management

The `web-settings` Account tab SHALL let an authenticated user change their password in-session using `POST /api/v1/auth/change-password` (current / new / confirm fields), replacing the prior stopgap that triggered the forgot-password email flow. Validation errors (`422` weak password, `401`/`403` wrong current password) surface inline and keep the form editable; on success the form clears and a confirmation is shown.

#### Scenario: In-session password change from Settings

- **WHEN** the user fills current + new + matching confirm and submits, and the backend returns success
- **THEN** the form clears, a success confirmation is shown, and no forgot-password email is sent

#### Scenario: Wrong current password surfaces inline

- **WHEN** the backend returns `401`/`403` because the current password is wrong
- **THEN** an inline error is shown on the current-password field and the form stays editable with entered values preserved (except passwords)
