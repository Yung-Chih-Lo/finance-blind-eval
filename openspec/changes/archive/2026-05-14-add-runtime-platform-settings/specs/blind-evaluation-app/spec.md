## ADDED Requirements

### Requirement: Runtime platform settings
The system SHALL load runtime platform settings from a server-side settings file when it exists, and SHALL fall back to the repository default evaluation config when runtime settings have not been created.

#### Scenario: Runtime settings missing
- **WHEN** no runtime settings file exists
- **THEN** the system uses the repository default evaluation config
- **AND** reports the settings source as the default config

#### Scenario: Runtime settings present
- **WHEN** a valid runtime settings file exists
- **THEN** the system uses the runtime settings for server-side evaluation limits, prompt categories, facets, flags, labels, study copy, and model IDs
- **AND** reports the active `settingsVersion`

#### Scenario: Runtime settings invalid
- **WHEN** the runtime settings file exists but fails validation
- **THEN** admin settings APIs return a configuration error
- **AND** evaluation answer generation rejects new requests before calling the model gateway

### Requirement: Admin platform settings API
The system SHALL provide protected admin APIs to read, save, reset, and export runtime platform settings.

#### Scenario: Admin reads platform settings
- **WHEN** an authenticated admin calls `GET /api/admin/settings`
- **THEN** the system returns the active settings envelope, settings source, version, and update metadata

#### Scenario: Admin saves valid platform settings
- **WHEN** an authenticated admin calls `PUT /api/admin/settings` with a valid complete config payload
- **THEN** the system validates and persists the settings under `.data`
- **AND** increments `settingsVersion`
- **AND** returns the saved settings envelope without exposing any API secrets

#### Scenario: Admin saves invalid platform settings
- **WHEN** an authenticated admin calls `PUT /api/admin/settings` with missing required study copy, prompt categories, labels, facets, flags, or limits
- **THEN** the system rejects the request with a validation error
- **AND** does not overwrite the previously active settings file

#### Scenario: Admin resets platform settings
- **WHEN** an authenticated admin calls `POST /api/admin/settings/reset`
- **THEN** the system restores repository default config as the active runtime settings
- **AND** records the reset as a new `settingsVersion`

#### Scenario: Admin exports platform settings
- **WHEN** an authenticated admin calls `GET /api/admin/settings/export`
- **THEN** the system returns a downloadable JSON representation of the active settings envelope

### Requirement: Settings version reproducibility
The system SHALL attach settings metadata to newly generated pending questions and saved evaluation records so research exports can identify which platform settings produced each answer.

#### Scenario: Pending question generated
- **WHEN** the system generates blind answers for a participant question
- **THEN** the pending question stores the active `settingsVersion`
- **AND** stores a deterministic settings snapshot hash

#### Scenario: Evaluation record saved
- **WHEN** the participant saves a valid judgment for a pending question
- **THEN** the evaluation record preserves the pending question's settings metadata

#### Scenario: Data exported
- **WHEN** an admin exports evaluation data as JSON or CSV
- **THEN** each record includes the settings version and settings snapshot hash when available

## MODIFIED Requirements

### Requirement: Configurable study content
The system SHALL load study copy, signature metadata, prompt categories, examples, evaluation facets, flags, and question limits from runtime platform settings when available, with the repository configuration file used as the default template and fallback.

#### Scenario: Study copy rendered
- **WHEN** the participant entry and completion pages render
- **THEN** visible study copy SHALL come from the active platform settings rather than hardcoded component strings

#### Scenario: Prompt examples rendered
- **WHEN** a participant starts any guided question page
- **THEN** the five clickable examples for that page SHALL come from the active platform settings

#### Scenario: Runtime settings not yet initialized
- **WHEN** the app starts before any runtime settings file has been saved
- **THEN** the active platform settings SHALL match the repository default config
