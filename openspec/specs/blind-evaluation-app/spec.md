# blind-evaluation-app Specification

## Purpose
TBD - created by archiving change migrate-vite-to-nextjs. Update Purpose after archive.
## Requirements
### Requirement: Participant token entry
The system SHALL provide a participant evaluation entry route at `/` (root) that requires a researcher-distributed shared invite code before creating an anonymous participant session. The shared invite code SHALL be sourced from the `SHARED_INVITE_CODE` server environment variable. The route SHALL hard-block re-entry when a completion cookie (`eval_completed=1`) is present on the request.

#### Scenario: Invite code entered
- **WHEN** a participant opens `/` without an `eval_completed` cookie and enters a value matching `SHARED_INVITE_CODE`
- **THEN** the system creates an anonymous participant token (`P-XXXXXXXX`) and an httpOnly session cookie
- **AND** advances to the background form

#### Scenario: Invite query provided
- **WHEN** a participant opens `/?invite_code=ailab502` without an `eval_completed` cookie
- **THEN** the system pre-fills the invite-code field with the URL value without treating that string as a participant identity

#### Scenario: Invite code mismatch
- **WHEN** a participant submits an invite code value that does not match `SHARED_INVITE_CODE`
- **THEN** the system rejects the redeem request with a 403 response and SHALL NOT create a participant or session

#### Scenario: Shared invite code not configured
- **WHEN** the server receives a redeem request while `SHARED_INVITE_CODE` is unset or empty
- **THEN** the system returns 503 with a service-configuration error message and SHALL NOT create a participant or session

#### Scenario: Re-entry blocked by completion cookie
- **WHEN** a participant opens `/` with an `eval_completed=1` cookie present
- **THEN** the page server-side renders a "已完成測驗" terminal view that does NOT show the invite-code input or the start button

#### Scenario: Server-side re-entry guard
- **WHEN** a `POST /api/session/redeem-invite` request arrives carrying an `eval_completed=1` cookie
- **THEN** the API rejects the request with 403 before evaluating the invite code

#### Scenario: Arbitrary participant token in URL
- **WHEN** a participant opens `/?token=123456`
- **THEN** the system SHALL NOT use that token as authorization or create a participant from it

### Requirement: Participant background form
The system SHALL require participants to submit background data before answering guided evaluation questions.

#### Scenario: Required background data missing
- **WHEN** a participant submits the background form without grade or occupation
- **THEN** the system prevents progression and displays a validation message

#### Scenario: Background data completed
- **WHEN** a participant submits business or finance background, grade or occupation, finance course history, finance familiarity, and LLM usage experience
- **THEN** the system stores the profile through a server API boundary and advances to question 1

### Requirement: Guided flexible prompt flow
The system SHALL present exactly five guided prompt categories for participant-authored finance questions.

#### Scenario: Participant starts question flow
- **WHEN** the participant completes the background form
- **THEN** the system displays question 1 of 5 with the first guided finance category

#### Scenario: Participant submits a short question
- **WHEN** the participant submits a question that fails the minimum completeness validation
- **THEN** the system rejects the submission and keeps the participant on the current question

### Requirement: Server-mediated model answer generation
The system SHALL generate answer A, answer B, and answer C through a Next.js server route only after validating the active participant session and active provider settings.

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
- **THEN** the API rejects the request before calling the model gateway

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

### Requirement: Hidden answer mapping
The system SHALL keep the mapping between A/B/C labels and real model IDs server-side.

#### Scenario: Participant receives answers
- **WHEN** the server returns answer A, answer B, and answer C to the browser
- **THEN** the response excludes real model IDs and hidden mapping data

#### Scenario: Admin reviews records
- **WHEN** an admin views per-question records
- **THEN** the system can show the hidden mapping for research analysis

### Requirement: Required blind comparison judgments
The system SHALL require participants to submit explicit comparative judgments whose target is an answer label, including overall best, overall worst, best by correctness, best by financial reasoning, best by completeness, best by readability, and at least one free-text reason before saving a question judgment.

#### Scenario: Best or worst selection missing
- **WHEN** the participant attempts to save a judgment without selecting both overall best and overall worst answers
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Same answer selected as best and worst
- **WHEN** the participant attempts to save a judgment with the same answer selected as overall best and overall worst
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Facet selection missing
- **WHEN** the participant attempts to save a judgment without selecting an answer for correctness, financial reasoning, completeness, or readability
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Reason missing
- **WHEN** the participant attempts to save a judgment with no best reason and no worst reason
- **THEN** the system rejects the save and displays a validation message

### Requirement: Evaluation record storage
The system SHALL store each answered question with participant token, participant profile, question metadata, blinded answers, hidden mapping, overall best and worst labels, facet-best labels for correctness, financial reasoning, completeness, and readability, reasons, worst-answer quality flags, timestamp, response latency, and completion status.

#### Scenario: Question judgment saved
- **WHEN** the participant saves a valid comparative judgment
- **THEN** the system persists a complete evaluation record through a server API route

#### Scenario: Fifth question saved
- **WHEN** the participant saves the fifth question judgment
- **THEN** the system marks the participant as completed and shows a thank-you page without model results

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page at `/admin` organized as a Tabbed Single Page research console with seven tabs — `總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料` — and a persistent KPI bar at the top showing participant count, completion count, question record count, completion percentage, and finance-vs-non-finance breakdown. Each tab SHALL be navigable via the `tab` URL search parameter so admins can deep-link.

#### Scenario: Admin opens dashboard
- **WHEN** an admin opens `/admin` without a `tab` query parameter
- **THEN** the system renders the KPI bar with the participant/record metrics and selects the `總覽` tab by default

#### Scenario: Admin opens a specific tab via URL
- **WHEN** an admin opens `/admin?tab=models`
- **THEN** the system renders the same KPI bar and activates the `模型結果` tab

#### Scenario: Admin reviews participant funnel
- **WHEN** the `總覽` tab is active
- **THEN** the page displays a participant funnel visualizing four stages — Redeemed, Profile completed, Answered any question, Completed — each with absolute count and the percentage retained from the previous stage

#### Scenario: Admin reviews attention items
- **WHEN** the `總覽` tab is active and evaluation records exist
- **THEN** the page lists (a) the top three worst-answer flags by model, (b) records whose response latency exceeds the dataset p95, and (c) up to five stalled participants who started but have not completed

#### Scenario: Admin reviews model leaderboard
- **WHEN** the `總覽` tab or `模型結果` tab is active and evaluation records exist
- **THEN** the page renders a model leaderboard sorted by net (best − worst), with each row showing a proportional horizontal bar, best count, worst count, and net value rendered with a positive/negative badge

#### Scenario: Admin reviews model comparison table
- **WHEN** the `模型結果` tab is active and evaluation records exist
- **THEN** the page displays each model's overall best count, overall worst count, best-worst net score, and selections for correctness, financial reasoning, completeness, and readability, with numeric columns right-aligned

#### Scenario: Admin reviews question records list
- **WHEN** the `原始資料` tab is active and question records exist
- **THEN** the page lists each record as a row of participant token, question index, prompt category, selected overall best, selected overall worst, and response latency only — long-form fields are NOT rendered in the table

#### Scenario: Admin inspects a record detail
- **WHEN** the admin clicks a row in the question records list
- **THEN** the page opens a side drawer showing the full user question text, all facet selections, worst-answer flags, hidden model mapping, and any reason text for that record
- **AND** closing the drawer returns focus to the originating row

#### Scenario: Admin reviews participant status table
- **WHEN** the `受測者` tab is active
- **THEN** the page lists each participant with token, business-or-finance background, finance familiarity, LLM experience, completion status, and answered-count over question limit

#### Scenario: Admin views the shared invite code
- **WHEN** the `邀請碼` tab is active and `SHARED_INVITE_CODE` is configured
- **THEN** the page renders the configured invite code as read-only text alongside a QR-code image whose payload is `${origin}/?invite_code=<code>` and a download action for the QR image
- **AND** the page SHALL NOT render any invite-generation form or batch-creation action

#### Scenario: Admin views the invite tab without configuration
- **WHEN** the `邀請碼` tab is active and `SHARED_INVITE_CODE` is unset or empty
- **THEN** the page renders a warning that the shared invite code is not configured and SHALL NOT render a QR image

#### Scenario: Admin edits provider settings
- **WHEN** the `Provider 設定` tab is active
- **THEN** the page renders the provider settings form unchanged from its previous behavior, wrapped in the admin Card surface

#### Scenario: Admin edits study copy
- **WHEN** the `問卷文案` tab is active
- **THEN** the page renders the study copy editor unchanged from its previous behavior, wrapped in the admin Card surface

#### Scenario: Admin views settings version
- **WHEN** any tab is active
- **THEN** the page surfaces the active settings version and source (`vN / source`) in the header region, not as a KPI tile

### Requirement: Data export
The system SHALL allow admin users to export evaluation data as JSON and CSV, including comparative facet selections and resolved model IDs.

#### Scenario: JSON export requested
- **WHEN** an admin requests JSON export
- **THEN** the system returns participant statuses and evaluation records in JSON format with comparative judgment fields

#### Scenario: CSV export requested
- **WHEN** an admin requests CSV export
- **THEN** the system returns one row per answered question with selected labels, facet labels, resolved model IDs, reasons, and worst-answer flags

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

### Requirement: Admin study copy editor
The system SHALL allow authenticated admins to edit participant-facing study copy from `/admin` without editing source files or runtime JSON by hand.

#### Scenario: Admin edits study identity copy
- **WHEN** an authenticated admin changes the study eyebrow, participant entry title, root page title, or root page description and saves the study-copy form
- **THEN** the system persists the updated config through the runtime platform settings API
- **AND** increments the settings version
- **AND** participant-facing pages render the updated copy on subsequent requests

#### Scenario: Admin edits intro letter copy
- **WHEN** an authenticated admin changes the intro greeting, intro paragraphs, or intro task list and saves the study-copy form
- **THEN** the participant entry page renders the updated intro letter copy from active platform settings

#### Scenario: Admin edits signature metadata
- **WHEN** an authenticated admin changes student name, affiliation, advisor/professor, closing, or thesis title and saves the study-copy form
- **THEN** the participant entry page renders the updated signature metadata from active platform settings

#### Scenario: Admin edits completion copy
- **WHEN** an authenticated admin changes completion eyebrow, completion title, completion description, or completion notes and saves the study-copy form
- **THEN** the completion page renders the updated completion copy from active platform settings

### Requirement: Admin prompt category copy editor
The system SHALL allow authenticated admins to edit the participant-facing copy for each configured prompt category without changing the category sequence in this change.

#### Scenario: Admin edits category title and instruction
- **WHEN** an authenticated admin changes a prompt category title or instruction and saves the study-copy form
- **THEN** the corresponding participant question page renders the updated title and instruction from active platform settings

#### Scenario: Admin edits category examples
- **WHEN** an authenticated admin changes the example questions for a prompt category and saves at least five non-empty examples
- **THEN** the corresponding participant question page renders the updated clickable examples from active platform settings

#### Scenario: Admin saves too few examples
- **WHEN** an authenticated admin saves a prompt category with fewer than five non-empty examples
- **THEN** the system rejects the save with a validation error
- **AND** does not overwrite the previously active runtime settings

### Requirement: Study copy settings preserve provider behavior
The system SHALL keep participant-facing study-copy settings separate from provider prompt-template behavior.

#### Scenario: Admin saves study copy only
- **WHEN** an authenticated admin saves the study-copy form without submitting provider settings
- **THEN** the system preserves the previously active provider endpoint, model mapping, prompt template, temperature, and max token settings

#### Scenario: Study metadata changed
- **WHEN** an authenticated admin changes student name, affiliation, advisor/professor, or thesis title through the study-copy form
- **THEN** those values are used for participant-visible questionnaire copy
- **AND** the provider prompt template variables remain limited to the existing supported variables unless a separate prompt-variable change is implemented

#### Scenario: Provider template helper shown
- **WHEN** an admin views the provider prompt template field
- **THEN** the UI distinguishes provider prompt-template variables from participant-facing study-copy fields

### Requirement: Completion cookie issuance
When a participant transitions to `completionStatus = "completed"`, the system SHALL set a cookie that allows server-side re-entry blocking on subsequent visits to the participant entry route.

#### Scenario: Completion cookie set on final question
- **WHEN** the server records the participant's final answer such that `completionStatus` becomes `"completed"`
- **THEN** the same HTTP response SHALL set a cookie named `eval_completed` with value `"1"`, `Max-Age=31536000`, `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` in production

#### Scenario: Completion cookie not set before completion
- **WHEN** the server records an answer that does NOT transition the participant to completed status
- **THEN** the response SHALL NOT set the `eval_completed` cookie

