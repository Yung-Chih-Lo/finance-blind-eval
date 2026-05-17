## MODIFIED Requirements

### Requirement: Provider model discovery
The system SHALL allow authenticated admins to discover model IDs from the configured OpenAI-compatible API base URL without exposing API secrets. The chat completions URL and the models URL SHALL both be derived from a single `apiBaseUrl` field by appending `/chat/completions` and `/models` respectively; an optional `modelsEndpointOverride` SHALL fully override the derived models URL when set.

#### Scenario: Admin discovers models
- **WHEN** an authenticated admin requests model discovery
- **THEN** the system calls the resolved models URL using the configured API-key environment variable
- **AND** returns the discovered model IDs and API key configured status
- **AND** does not return the raw API key

#### Scenario: Models URL derived from base URL
- **WHEN** provider settings include `apiBaseUrl` and no `modelsEndpointOverride`
- **THEN** the system uses `${apiBaseUrl}/models` (collapsing any trailing slash on the base) as the models URL
- **AND** uses `${apiBaseUrl}/chat/completions` as the chat completions URL

#### Scenario: Models URL override applied
- **WHEN** provider settings include both `apiBaseUrl` and a non-empty `modelsEndpointOverride`
- **THEN** the system uses `modelsEndpointOverride` verbatim as the models URL
- **AND** still derives the chat completions URL from `apiBaseUrl`

#### Scenario: Base URL contains chat completions suffix
- **WHEN** an authenticated admin submits an `apiBaseUrl` whose path ends with `/chat/completions`, `/chat/completions/`, or `/completions`
- **THEN** the system rejects the save with a validation error pointing to base-URL semantics
- **AND** does not overwrite the previously active provider settings

#### Scenario: Base URL contains query string or fragment
- **WHEN** an authenticated admin submits an `apiBaseUrl` containing a `?` query string or `#` fragment
- **THEN** the system rejects the save with a validation error
- **AND** does not overwrite the previously active provider settings

#### Scenario: Model discovery fails
- **WHEN** the resolved models URL is unreachable or returns a non-success response
- **THEN** the system returns an admin-visible error
- **AND** does not change runtime provider settings

### Requirement: Runtime platform settings
The system SHALL load runtime platform settings from a server-side settings file when it exists, including study config and non-secret provider settings, and SHALL fall back to the repository default evaluation config plus environment-derived provider defaults when runtime settings have not been created. The system SHALL reject runtime settings files whose persisted `provider` envelope uses the legacy `chatCompletionsEndpoint` or `modelsEndpoint` field shape.

#### Scenario: Runtime settings missing
- **WHEN** no runtime settings file exists
- **THEN** the system uses the repository default evaluation config
- **AND** derives default provider settings from server environment variables
- **AND** reports the settings source as the default config

#### Scenario: Runtime settings present
- **WHEN** a valid runtime settings file exists
- **THEN** the system uses the runtime settings for server-side evaluation limits, prompt categories, facets, flags, labels, study copy, model IDs, provider API base URL, models override, model mapping, prompts, temperature, and max tokens
- **AND** reports the active `settingsVersion`

#### Scenario: Runtime settings invalid
- **WHEN** the runtime settings file exists but fails validation
- **THEN** admin settings APIs return a configuration error
- **AND** evaluation answer generation rejects new requests before calling the model gateway

#### Scenario: Runtime settings use legacy provider schema
- **WHEN** the runtime settings file exists and its `provider` envelope contains the legacy `chatCompletionsEndpoint` or `modelsEndpoint` field
- **THEN** the system returns a configuration error explicitly identifying the legacy schema
- **AND** the error message instructs the admin to re-save or reset provider settings in `/admin`
- **AND** evaluation answer generation rejects new requests before calling the model gateway

### Requirement: Admin provider configuration UI
The system SHALL provide an admin-facing interface for editing non-secret OpenAI-compatible provider settings used by blind answer generation. The interface SHALL expose `apiBaseUrl` and an optional `modelsEndpointOverride` instead of a chat-completions URL.

#### Scenario: Admin views provider settings
- **WHEN** an authenticated admin opens `/admin`
- **THEN** the page displays the API base URL field, an optional models endpoint override field, API key env var name, API key configured status, model mapping controls, prompt fields, temperature, max tokens, and settings version
- **AND** the API base URL field includes helper text instructing admins to provide a base URL (for example `https://gateway.example.com/v1`) and to omit `/chat/completions`
- **AND** the page does not display raw API key values

#### Scenario: Admin saves provider settings
- **WHEN** an authenticated admin saves a valid API base URL, optional models override, model mapping, prompt, and generation settings
- **THEN** the system persists those settings through the runtime settings API
- **AND** increments `settingsVersion`

#### Scenario: Admin submits invalid provider settings
- **WHEN** an authenticated admin submits a missing or malformed API base URL, a base URL ending with `/chat/completions`, a base URL containing query string or fragment, incomplete model mapping, invalid prompt template, invalid temperature, or invalid max token settings
- **THEN** the system rejects the save with validation feedback
- **AND** does not overwrite the previously active provider settings

#### Scenario: Legacy provider schema detected on admin load
- **WHEN** an authenticated admin loads `/admin` while the persisted runtime settings file uses the legacy provider schema
- **THEN** the page surfaces a configuration banner explaining the schema migration
- **AND** offers re-save and reset-to-defaults actions that resolve the error
