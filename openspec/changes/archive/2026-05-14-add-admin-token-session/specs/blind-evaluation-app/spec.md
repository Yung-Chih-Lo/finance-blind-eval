## MODIFIED Requirements

### Requirement: Admin access protection
The system SHALL protect admin pages and admin APIs with an admin session created from a researcher-issued URL token, while retaining Basic Auth as a fallback when configured.

#### Scenario: Admin URL token exchanged
- **WHEN** an admin opens `/admin?token=valid-admin-token`
- **THEN** the system validates the token server-side
- **AND** sets an httpOnly admin session cookie
- **AND** redirects the browser to `/admin` without the token query parameter

#### Scenario: Invalid admin URL token
- **WHEN** an admin opens `/admin?token=invalid-admin-token`
- **THEN** the system rejects the request without setting an admin session cookie
- **AND** does not render protected admin data

#### Scenario: Admin session accesses dashboard
- **WHEN** a request opens `/admin` with a valid admin session cookie
- **THEN** the system renders the admin dashboard

#### Scenario: Admin session accesses admin API
- **WHEN** a request calls `/api/admin/*` with a valid admin session cookie
- **THEN** the system allows the admin API request to continue

#### Scenario: Admin request without session
- **WHEN** a request opens `/admin` or calls `/api/admin/*` without a valid admin session cookie
- **THEN** the system rejects the request unless valid Basic Auth fallback credentials are present

#### Scenario: Basic Auth fallback configured
- **WHEN** `ADMIN_PASSWORD` is configured and a request provides valid Basic Auth credentials
- **THEN** the system allows `/admin` and `/api/admin/*` access even without an admin session cookie

#### Scenario: Production admin auth missing
- **WHEN** the app runs in production without admin token configuration and without `ADMIN_PASSWORD`
- **THEN** admin routes return a service-configuration error instead of exposing data

