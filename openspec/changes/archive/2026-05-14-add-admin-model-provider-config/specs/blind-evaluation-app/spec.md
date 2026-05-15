## ADDED Requirements

### Requirement: Admin provider configuration UI
The system SHALL provide an admin-facing interface for editing non-secret OpenAI-compatible provider settings used by blind answer generation.

#### Scenario: Admin views provider settings
- **WHEN** an authenticated admin opens `/admin`
- **THEN** the page displays provider endpoint fields, API key env var name, API key configured status, model mapping controls, prompt fields, temperature, max tokens, and settings version
- **AND** the page does not display raw API key values

#### Scenario: Admin saves provider settings
- **WHEN** an authenticated admin saves valid provider endpoint, model mapping, prompt, and generation settings
- **THEN** the system persists those settings through the runtime settings API
- **AND** increments `settingsVersion`

#### Scenario: Admin submits invalid provider settings
- **WHEN** an authenticated admin submits missing endpoint, incomplete model mapping, invalid prompt template, invalid temperature, or invalid max token settings
- **THEN** the system rejects the save with validation feedback
- **AND** does not overwrite the previously active provider settings

### Requirement: Provider model discovery
The system SHALL allow authenticated admins to discover model IDs from the configured OpenAI-compatible models endpoint without exposing API secrets.

#### Scenario: Admin discovers models
- **WHEN** an authenticated admin requests model discovery
- **THEN** the system calls the configured models endpoint using the configured API-key environment variable
- **AND** returns the discovered model IDs and API key configured status
- **AND** does not return the raw API key

#### Scenario: Models endpoint omitted
- **WHEN** provider settings include a chat completions endpoint but omit a models endpoint
- **THEN** the system derives the models endpoint by replacing `/chat/completions` with `/models`

#### Scenario: Model discovery fails
- **WHEN** the configured models endpoint is unreachable or returns a non-success response
- **THEN** the system returns an admin-visible error
- **AND** does not change runtime provider settings

### Requirement: Provider preview testing
The system SHALL allow authenticated admins to run a provider preview without creating participant sessions, pending questions, or evaluation records.

#### Scenario: Admin previews configured provider
- **WHEN** an authenticated admin submits a preview prompt
- **THEN** the system calls the configured provider using the active model mapping and prompt settings
- **AND** returns preview responses, latency, and sanitized model names for admin review
- **AND** does not create or modify evaluation records

#### Scenario: Provider preview missing configuration
- **WHEN** an authenticated admin previews with missing endpoint, missing API key, or incomplete model mapping
- **THEN** the system rejects the preview with a configuration error before calling the provider

## MODIFIED Requirements

### Requirement: Runtime platform settings
The system SHALL load runtime platform settings from a server-side settings file when it exists, including study config and non-secret provider settings, and SHALL fall back to the repository default evaluation config plus environment-derived provider defaults when runtime settings have not been created.

#### Scenario: Runtime settings missing
- **WHEN** no runtime settings file exists
- **THEN** the system uses the repository default evaluation config
- **AND** derives default provider settings from server environment variables
- **AND** reports the settings source as the default config

#### Scenario: Runtime settings present
- **WHEN** a valid runtime settings file exists
- **THEN** the system uses the runtime settings for server-side evaluation limits, prompt categories, facets, flags, labels, study copy, model IDs, provider endpoints, model mapping, prompts, temperature, and max tokens
- **AND** reports the active `settingsVersion`

#### Scenario: Runtime settings invalid
- **WHEN** the runtime settings file exists but fails validation
- **THEN** admin settings APIs return a configuration error
- **AND** evaluation answer generation rejects new requests before calling the model gateway

### Requirement: Server-mediated model answer generation
The system SHALL generate answer A, answer B, and answer C through a Next.js server route only after validating the active invite session and active provider settings.

#### Scenario: Answers requested without invite session
- **WHEN** a browser calls `/api/evaluation/answers` without a valid evaluation session cookie
- **THEN** the API rejects the request before calling the model gateway

#### Scenario: Participant exceeds question limit
- **WHEN** a participant that already reached the configured max question count requests another answer generation
- **THEN** the API rejects the request before calling the model gateway

#### Scenario: Answers requested too frequently
- **WHEN** an IP or session exceeds configured answer-generation rate limits
- **THEN** the API rejects the request before calling the model gateway

#### Scenario: Provider settings invalid
- **WHEN** active provider settings are missing endpoint, API key, model mapping, prompt template, temperature, or max token configuration
- **THEN** the API rejects the request before creating a pending question
- **AND** the API does not call the model gateway

#### Scenario: Answers generated with runtime provider settings
- **WHEN** active provider settings are valid and a participant submits a valid question
- **THEN** the system calls the configured chat completions endpoint with the configured model mapping, system prompt, user prompt template, temperature, and max tokens
- **AND** stores the settings version and snapshot hash on the pending question

### Requirement: Gateway model discovery
The system SHALL discover available models from the configured OpenAI-compatible models endpoint before admins assign model mappings, and SHALL use admin-configured model mapping for formal blind comparison.

#### Scenario: Exactly three models available
- **WHEN** the configured models endpoint returns exactly three model IDs and no explicit mapping has been saved
- **THEN** the admin interface can offer those three model IDs as candidate mapping options

#### Scenario: More than three models available
- **WHEN** the configured models endpoint returns more than three model IDs
- **THEN** the admin interface requires the admin to select exactly one gateway model for each internal candidate model ID

#### Scenario: Formal generation with mapping
- **WHEN** runtime provider settings include a complete mapping for the configured internal model IDs
- **THEN** the server uses that mapping for answer generation instead of inferring model names from gateway IDs

### Requirement: Settings version reproducibility
The system SHALL attach settings metadata to newly generated pending questions and saved evaluation records so research exports can identify which study and provider settings produced each answer.

#### Scenario: Pending question generated
- **WHEN** the system generates blind answers for a participant question
- **THEN** the pending question stores the active `settingsVersion`
- **AND** stores a deterministic settings snapshot hash that includes study config and provider settings

#### Scenario: Evaluation record saved
- **WHEN** the participant saves a valid judgment for a pending question
- **THEN** the evaluation record preserves the pending question's settings metadata

#### Scenario: Data exported
- **WHEN** an admin exports evaluation data as JSON or CSV
- **THEN** each record includes the settings version and settings snapshot hash when available
