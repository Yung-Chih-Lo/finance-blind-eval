## MODIFIED Requirements

### Requirement: Participant token entry
The system SHALL provide a participant evaluation entry route at `/eval` that requires a researcher-issued invite code before creating an anonymous participant session.

#### Scenario: Invite code entered
- **WHEN** a participant opens `/eval` and enters a valid invite code
- **THEN** the system creates an anonymous participant token and an httpOnly session cookie
- **AND** advances to the background form

#### Scenario: Invite query provided
- **WHEN** a participant opens `/eval?invite=ABCD-EFGH`
- **THEN** the system pre-fills the invite-code field without treating the invite code as a participant identity

#### Scenario: Arbitrary participant token in URL
- **WHEN** a participant opens `/eval?token=123456`
- **THEN** the system SHALL NOT use that token as authorization or create a participant from it

### Requirement: Server-mediated model answer generation
The system SHALL generate answer A, answer B, and answer C through a Next.js server route only after validating the active invite session.

#### Scenario: Answers requested without invite session
- **WHEN** a browser calls `/api/evaluation/answers` without a valid evaluation session cookie
- **THEN** the API rejects the request before calling the model gateway

#### Scenario: Participant exceeds question limit
- **WHEN** a participant that already reached the configured max question count requests another answer generation
- **THEN** the API rejects the request before calling the model gateway

#### Scenario: Answers requested too frequently
- **WHEN** an IP or session exceeds configured answer-generation rate limits
- **THEN** the API rejects the request before calling the model gateway

## ADDED Requirements

### Requirement: Configurable study content
The system SHALL load study copy, signature metadata, prompt categories, examples, evaluation facets, flags, and question limits from a repository configuration file.

#### Scenario: Study copy rendered
- **WHEN** the participant entry and completion pages render
- **THEN** visible study copy SHALL come from the platform config rather than hardcoded component strings

#### Scenario: Prompt examples rendered
- **WHEN** a participant starts any guided question page
- **THEN** the five clickable examples for that page SHALL come from the platform config

### Requirement: Invite and QR administration
The system SHALL provide researcher tooling to generate invite codes and QR-code links without committing live invite codes to the public repository.

#### Scenario: Admin generates invites through API
- **WHEN** an admin requests invite generation
- **THEN** the system creates hashed invite records and returns plaintext codes, entry links, and QR SVGs in the response

#### Scenario: Researcher generates invites through CLI
- **WHEN** a researcher runs the invite-generation script with a base URL and count
- **THEN** the script writes hashed invite records, a CSV distribution list, and QR SVG files under `.data`

### Requirement: Admin access protection
The system SHALL protect admin pages and admin APIs with Basic Auth when an admin password is configured.

#### Scenario: Admin password configured
- **WHEN** a request opens `/admin` or `/api/admin/*` without valid Basic Auth credentials
- **THEN** the system rejects the request with an authentication challenge

#### Scenario: Production admin password missing
- **WHEN** the app runs in production without `ADMIN_PASSWORD`
- **THEN** admin routes return a service-configuration error instead of exposing data
