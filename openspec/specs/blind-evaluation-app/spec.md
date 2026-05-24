# blind-evaluation-app Specification

## Purpose
TBD - created by archiving change migrate-vite-to-nextjs. Update Purpose after archive.
## Requirements
### Requirement: Participant token entry
The system SHALL provide a participant evaluation entry route at `/` (root) that requires a researcher-distributed shared invite code before creating an anonymous participant session. The shared invite code SHALL be sourced from the `SHARED_INVITE_CODE` server environment variable. The route SHALL hard-block re-entry when a completion cookie (`eval_completed=1`) is present on the request. The entry page SHALL present a structured study briefing before the invite-code submit action, including study purpose, time/question scope, blind comparison tasks, privacy/sensitive-data guidance, and a non-investment-advice boundary.

#### Scenario: Study briefing shown before start
- **WHEN** a participant opens `/` without an `eval_completed` cookie
- **THEN** the entry page shows the study title, expected duration, question count, blind model-comparison task, privacy/sensitive-data warning, and non-investment-advice boundary before or alongside the invite-code form

### Requirement: Participant background form
The system SHALL require participants to submit non-identifying background data before answering guided evaluation questions, including gender, age range, education level, finance background type, finance work or internship experience, investment experience, finance familiarity, general LLM usage, whether they have used AI for finance tasks, and finance subdomain familiarity. The system SHALL accept an optional grade or occupation free-text field. The system SHALL NOT collect the legacy `fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, or finance-LLM-usage 5-level enum fields.

#### Scenario: Required background data missing
- **WHEN** a participant submits the background form without a required profile field
- **THEN** the system prevents progression and displays a validation message

#### Scenario: Background data completed
- **WHEN** a participant submits gender, age range, education level, finance background type, finance work or internship experience, investment experience, finance familiarity, general LLM usage, whether they have used AI for finance tasks, and at least one finance subdomain selection
- **THEN** the system stores the profile through a server API boundary and advances to question 1

#### Scenario: Optional grade or occupation provided
- **WHEN** a participant submits the background form with a non-empty grade or occupation free-text value
- **THEN** the system stores that value with the profile

#### Scenario: Optional grade or occupation omitted
- **WHEN** a participant submits the background form leaving the grade or occupation free-text field empty
- **THEN** the system stores the profile and advances without raising a validation error for that field

#### Scenario: Gender prefer-not-to-say accepted
- **WHEN** a participant selects `不願透露` for the gender field
- **THEN** the system stores the profile and treats the value as a valid sample-description response

#### Scenario: Age range under-20 bucket removed
- **WHEN** the participant background form renders
- **THEN** the age-range options do NOT include an `under_20` bucket
- **AND** the available age-range options are `20-24`, `25-29`, `30-39`, `40 歲以上`, and `不願透露`

#### Scenario: Existing session has legacy profile shape
- **WHEN** a participant has a saved profile that lacks any of the new required fields (gender, education level, finance background type, or whether they have used AI for finance tasks), or that still contains any of the removed legacy fields (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, finance-LLM-usage 5-level value)
- **THEN** the participant returns to the profile form with compatible existing fields prefilled (age range, finance familiarity, general LLM usage, finance work or internship experience, investment experience, finance subdomain selections, and optional grade or occupation)
- **AND** the form does NOT advance to the question flow until the participant submits the new required fields

#### Scenario: Has-used-AI-for-finance Y/N requires explicit selection
- **WHEN** a participant attempts to submit the background form without explicitly choosing yes or no for whether they have used AI for finance tasks
- **THEN** the system rejects the submission with a validation message indicating the field is required
- **AND** the system does NOT default the value to `false` or to any other choice

#### Scenario: Legacy session has pending question
- **WHEN** a participant with a legacy profile shape (missing any new required field, or carrying any removed legacy field) successfully resubmits a profile in the current shape, and that participant already owned one or more pending question entries generated under the legacy profile
- **THEN** the system removes all pending question entries owned by that participant token
- **AND** a subsequent answer-generation request for any question index for that participant succeeds without a 409 conflict
- **AND** the next saved evaluation record for that participant carries the new-shape profile snapshot, not the legacy snapshot

### Requirement: Guided flexible prompt flow
The system SHALL present exactly five guided prompt categories for participant-authored finance questions.

#### Scenario: Participant starts question flow
- **WHEN** the participant completes the background form
- **THEN** the system displays question 1 of 5 with the first guided finance category

#### Scenario: Participant sees category-specific guidance
- **WHEN** any guided question page renders
- **THEN** the page displays category-specific instruction text that keeps the question finance-related without requiring the participant to copy a fixed question
- **AND** the question input placeholder reminds participants to avoid personal holdings, internal data, real-time price questions, and direct buy/sell advice requests

#### Scenario: Participant submits a short question
- **WHEN** the participant submits a question that fails the minimum completeness validation
- **THEN** the system rejects the submission and keeps the participant on the current question

#### Scenario: Participant resets the current question after answers were generated
- **WHEN** the participant clicks 「重新輸入本題」 while the A/B/C comparison view is showing
- **THEN** the system discards the server-side pending question for the current question index
- **AND** clears the local comparison state and returns the participant to an empty question input
- **AND** a subsequent submission of the same question index succeeds without a 409 conflict
- **AND** a page refresh does NOT rehydrate the prior A/B/C comparison view

#### Scenario: Participant resets but the server delete call fails
- **WHEN** the participant clicks 「重新輸入本題」 and the DELETE call to the answers endpoint fails
- **THEN** the system shows an error toast
- **AND** keeps the A/B/C comparison view intact so the participant can retry the reset or continue judging

### Requirement: Server-mediated model answer generation
The system SHALL generate answer A, answer B, and answer C through a Next.js server route only after validating the active participant session and active provider settings, and SHALL allow the owning participant to discard a pending question through the same route.

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

#### Scenario: Owning participant deletes a pending question
- **WHEN** the owning participant calls `DELETE /api/evaluation/answers` with the `questionId` of a pending question whose `participantToken` matches their active session
- **THEN** the API removes that pending question from storage
- **AND** responds with HTTP 204

#### Scenario: Delete called without invite session
- **WHEN** a browser calls `DELETE /api/evaluation/answers` without a valid evaluation session cookie
- **THEN** the API rejects the request with HTTP 401 and does not modify storage

#### Scenario: Delete called for another participant's pending question
- **WHEN** a participant calls `DELETE /api/evaluation/answers` with a `questionId` whose `participantToken` does not match their active session
- **THEN** the API rejects the request with HTTP 403 and does not modify storage

#### Scenario: Delete called for an unknown or already-removed pending question
- **WHEN** a participant calls `DELETE /api/evaluation/answers` with a `questionId` that no longer exists in pending storage
- **THEN** the API responds with HTTP 204 and does not modify storage

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
The system SHALL require participants to submit explicit comparative judgments whose target is an answer label, including overall best, overall worst, best by correctness, best by completeness, best by readability, and at least one free-text reason before saving a question judgment. The system SHALL NOT require or accept a `best by financial reasoning` selection.

#### Scenario: Best or worst selection missing
- **WHEN** the participant attempts to save a judgment without selecting both overall best and overall worst answers
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Same answer selected as best and worst
- **WHEN** the participant attempts to save a judgment with the same answer selected as overall best and overall worst
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Facet selection missing
- **WHEN** the participant attempts to save a judgment without selecting an answer for correctness, completeness, or readability
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Reasoning facet not collected
- **WHEN** the question judgment screen renders
- **THEN** the facet comparison list contains exactly three entries — correctness, completeness, and readability
- **AND** no `reasoning` facet input is rendered

#### Scenario: Reason missing
- **WHEN** the participant attempts to save a judgment with no best reason and no worst reason
- **THEN** the system rejects the save and displays a validation message

### Requirement: Evaluation record storage
The system SHALL store each answered question with participant token, participant profile including expanded non-identifying background fields, question metadata, blinded answers, hidden mapping, overall best and worst labels, facet-best labels for correctness, completeness, and readability, reasons, worst-answer quality flags, timestamp, response latency, and completion status. The system SHALL NOT require a `reasoning` facet-best label on newly stored records.

#### Scenario: Question judgment saved
- **WHEN** the participant saves a valid comparative judgment after completing the expanded profile
- **THEN** the system persists a complete evaluation record through a server API route including the participant profile snapshot
- **AND** the persisted record's `facetSelections` keys are exactly `correctness`, `completeness`, and `readability` (any historical `reasoning` key on pre-existing records is preserved verbatim but no new record SHALL emit one)

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page at `/admin` organized as a Tabbed Single Page research console with seven tabs — `總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料` — and a persistent KPI bar at the top showing participant count, completion count, question record count, completion percentage, and a finance-background breakdown derived from finance background type. Each tab SHALL be navigable via the `tab` URL search parameter so admins can deep-link.

#### Scenario: Admin reviews participant status table
- **WHEN** the `受測者` tab is active
- **THEN** the page lists each participant with token, finance background type label, age range, gender, education level, finance familiarity, whether they have used AI for finance tasks (Y/N), completion status, and answered-count over question limit
- **AND** the page does NOT render the removed legacy columns (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, finance-LLM-usage 5-level enum)

#### Scenario: KPI bar reports finance-background breakdown
- **WHEN** the admin opens any admin tab
- **THEN** the KPI bar derives the finance-background breakdown by counting participants whose finance background type is `student_finance_related` or `working_finance_related` as the finance-relevant group, participants whose finance background type is `student_other` or `working_other` as the non-finance group, and participants whose finance background type is `prefer_not_to_say` as a separate refusal bucket
- **AND** legacy records that lack `financeBackgroundType` SHALL be counted under an `unknown` bucket without erroring

#### Scenario: Admin inspects a record detail
- **WHEN** the admin clicks a row in the question records list
- **THEN** the page opens a side drawer showing the full user question text, participant profile snapshot (including the new gender, education level, finance background type, and `hasUsedAiForFinance` fields when present), all facet selections, worst-answer flags, hidden model mapping, and any reason text for that record
- **AND** for legacy records the drawer renders any legacy fields that were stored with the original profile snapshot, prefixed with a `legacy` label

### Requirement: Data export
The system SHALL allow admin users to export evaluation data as JSON and CSV, including comparative facet selections, resolved model IDs, and the current expanded participant profile fields.

#### Scenario: CSV export requested
- **WHEN** an admin requests CSV export
- **THEN** the system returns one row per answered question with selected labels, facet labels, resolved model IDs, reasons, worst-answer flags, and active-profile columns covering token, gender, age range, education level, optional grade or occupation, finance background type, finance work or internship experience, investment experience, finance familiarity, general LLM usage, `hasUsedAiForFinance`, and finance subdomain selections
- **AND** the CSV header always includes four legacy-cohort columns appended after the active-profile columns: `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, `legacy_finance_llm_usage`
- **AND** new-shape records emit empty values in the four `legacy_*` columns

#### Scenario: Legacy record exported
- **WHEN** an admin requests CSV export and one or more stored records were saved before this change with the legacy profile shape
- **THEN** legacy records appear in the export with empty cells for the new active-profile columns (gender, education level, finance background type, `hasUsedAiForFinance`)
- **AND** legacy records emit their original legacy field values verbatim in the four `legacy_*` columns
- **AND** the export does NOT fail or omit those records

#### Scenario: JSON export preserves legacy profile
- **WHEN** an admin requests JSON export and at least one stored record uses the legacy profile shape
- **THEN** each legacy record's JSON object includes a nested `legacyProfile` block containing the four legacy fields (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`)
- **AND** new-shape records do NOT include the `legacyProfile` block

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

### Requirement: Participant study validity instructions
The system SHALL present concise study-validity instructions before invite-code submission, including expected duration, required question count, model anonymity, privacy scope, sensitive-data avoidance, and non-investment-advice scope.

#### Scenario: Participant opens entry page
- **WHEN** a participant opens `/` without an `eval_completed` cookie
- **THEN** the entry page shows that the questionnaire takes about 8-12 minutes
- **AND** shows that the participant will answer 5 finance-related questions
- **AND** explains that answers are anonymized as A/B/C and model identities are hidden
- **AND** tells participants not to enter names, accounts, holdings, company-internal information, or other sensitive personal data
- **AND** states that model answers are for research evaluation only and do not constitute investment advice

#### Scenario: Participant-visible terminology
- **WHEN** participant-facing primary actions, headers, and completion copy render
- **THEN** the UI uses questionnaire or blind-evaluation wording
- **AND** the UI does not frame the participant flow as a "測驗" of the participant

### Requirement: Participant comparison screen excludes latency
The system SHALL hide model response latency from participant-facing answer comparison screens while preserving latency for admin troubleshooting and exports.

#### Scenario: Participant compares generated answers
- **WHEN** answer A, answer B, and answer C are displayed to the participant
- **THEN** the participant page does not show response latency or millisecond timing
- **AND** the page still shows only blind answer labels and answer text

#### Scenario: Admin reviews latency
- **WHEN** an admin views records or exports evaluation data
- **THEN** response latency remains available in admin views and exported records

### Requirement: Reason guidance is explicit
The system SHALL make best/worst reason expectations clear in the participant judgment form without adding new response fields.

#### Scenario: Participant sees reason fields
- **WHEN** the participant reaches the judgment form for a generated answer set
- **THEN** the UI labels best and worst reason fields as short-answer explanations
- **AND** the UI explains that at least one reason is required and both are preferred when the participant can answer both

#### Scenario: Participant submits no reason
- **WHEN** the participant attempts to save a judgment with no best reason and no worst reason
- **THEN** the system rejects the save and displays a validation message

### Requirement: Participant intro neutral terminology
The participant-facing study intro and signature copy SHALL avoid researcher-only or method-specific terminology so participants are not led toward a particular model preference and so the underlying training method is not disclosed.

#### Scenario: Intro copy avoids researcher-only terms
- **WHEN** the participant entry page renders the active `study.intro.paragraphs` from runtime platform settings
- **THEN** none of the rendered paragraphs SHALL contain the strings `大型語言模型`, `APT`, `H1`, `H2`, `TAIDE`, `validation loss`, `validation roles`, `盲測`, `H1-base`, `H2-base`, `主要分層變項`, or `預先指定`
- **AND** the paragraphs SHALL refer to the system under evaluation as `金融語言模型` (or an equivalent finance-domain framing) rather than as a general-purpose model

#### Scenario: Signature title avoids exposing training method
- **WHEN** the participant entry page renders the active `study.signature.thesisTitle` from runtime platform settings
- **THEN** the rendered title SHALL NOT contain the strings `Augmentative`, `Residual`, `Adapter`, or `APT`

#### Scenario: Default config seeds neutral intro
- **WHEN** the repository default `web/config/evaluation.config.json` is used as the active platform settings source (no runtime settings file exists yet)
- **THEN** the default `study.intro` SHALL contain exactly four paragraphs ordered as (1) thank-you and finance-language-model study purpose, (2) flow description of 5 questions × 3 anonymous answers and correctness / completeness / readability rating, (3) duration of 8-12 minutes and content scope of background data plus 5 finance questions, (4) data use scope plus sensitive-data prohibition plus non-investment-advice disclaimer
- **AND** the default `study.intro.tasks` SHALL contain exactly three items describing the participant action sequence (enter a question, view three anonymous answers, choose overall better answer and rate three facets)
- **AND** the default `study.signature.thesisTitle` SHALL be a neutral Chinese title that satisfies the `Signature title avoids exposing training method` scenario

### Requirement: Provider default system prompt finance-brain scope
The server-side `DEFAULT_SYSTEM_PROMPT` constant SHALL define the model as a finance-domain assistant (`金融語言模型` / `金融腦`) and SHALL instruct the model to refuse out-of-scope or real-time questions rather than answering them on best effort. The same default SHALL apply uniformly across all configured internal model IDs so that prompt-design differences do not contaminate the blind comparison.

#### Scenario: Default prompt declares finance-only scope
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL define the assistant as `金融語言模型` / `金融腦` (or equivalent wording)
- **AND** SHALL list at least the topical scope `金融`, `投資`, `財務`, `會計`, `總經`, `市場` as in-scope (the prompt may add others)
- **AND** SHALL instruct the model to politely refuse non-finance questions while explaining the service scope

#### Scenario: Default prompt refuses real-time / external-tool queries
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to decline questions that require real-time data (such as current quotes, today's market news, or live exchange rates) by explaining that the model cannot access live data, rather than fabricating a current value

#### Scenario: Default prompt forbids leaking evaluation metadata
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to NOT mention model names, the existence of blind testing, or `A`/`B`/`C` answer labels in its output

#### Scenario: Default prompt restricts investment-advice phrasing
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to decline giving specific buy / sell / hold instructions for individual securities while still allowing the model to explain concepts, frameworks, and risks

#### Scenario: Default prompt requires Traditional Chinese output
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to respond in Traditional Chinese (`繁體中文`)

#### Scenario: Same default applies to all internal model IDs
- **WHEN** a server-side answer-generation call resolves provider settings via `normalizeProviderSettings` with no admin override of `systemPrompt`
- **THEN** the same default `systemPrompt` string SHALL be used for every internal model ID listed in `MODEL_IDS` (`H1-best`, `H2-best`, `TAIDE-baseline`)
- **AND** the provider settings shape SHALL NOT introduce per-model `systemPrompt` overrides in this change

### Requirement: Participant five-question completion gate
The system SHALL refuse to transition a participant's `completionStatus` to `"completed"` until that participant has saved exactly five evaluation records, and SHALL only emit the `eval_completed` cookie after that transition.

#### Scenario: Completion not granted before the fifth answered question
- **WHEN** a participant has saved one, two, three, or four evaluation records and submits another judgment for an in-progress question that would not become record number five
- **THEN** the server SHALL persist that record with `completionStatus = "answered"` for the record itself
- **AND** the participant's `ParticipantStatus.completionStatus` SHALL remain `"in_progress"` (not `"completed"`)
- **AND** the HTTP response SHALL NOT set the `eval_completed` cookie

#### Scenario: Completion granted on the fifth answered question
- **WHEN** a participant submits the judgment whose successful save brings their saved evaluation record count to exactly five
- **THEN** the server SHALL set the participant's `ParticipantStatus.completionStatus` to `"completed"`
- **AND** the HTTP response SHALL set the `eval_completed` cookie per the existing `Completion cookie issuance` requirement
- **AND** subsequent answer-generation calls for that participant token SHALL be rejected per the existing `Participant exceeds question limit` scenario

#### Scenario: Sixth record write is impossible
- **WHEN** a participant whose `completionStatus` already equals `"completed"` somehow reaches the answer-save endpoint with a sixth pending question
- **THEN** the server SHALL reject the save with a participant-exceeded-limit error and SHALL NOT persist a sixth record

