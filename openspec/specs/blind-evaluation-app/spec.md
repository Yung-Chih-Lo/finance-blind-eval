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
The system SHALL require participants to submit non-identifying background data before answering guided evaluation questions, consisting of exactly five fields: age range, education level, current main domain, AI usage frequency, and whether they have used AI for finance tasks. All five fields SHALL be required and SHALL NOT offer a `prefer_not_to_say` option. The system SHALL NOT collect gender, finance familiarity scale, investment experience, finance work or internship experience, finance subdomain selections, optional grade or occupation free-text, participant-side notes, or any legacy field (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, finance-LLM-usage 5-level enum, or `knownName`).

#### Scenario: Required background data missing
- **WHEN** a participant submits the background form without selecting one of the five required fields (age range, education level, current main domain, AI usage frequency, or whether they have used AI for finance tasks)
- **THEN** the system prevents progression and displays a validation message identifying the missing field

#### Scenario: Background data completed
- **WHEN** a participant submits a profile that includes a value for age range, education level, current main domain, AI usage frequency, and a yes/no answer for whether they have used AI for finance tasks
- **THEN** the system stores the profile through a server API boundary and advances to question 1
- **AND** the persisted profile object contains exactly the keys `token`, `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, and `hasUsedAiForFinance`

#### Scenario: Has-used-AI-for-finance Y/N requires explicit selection
- **WHEN** a participant attempts to submit the background form without explicitly choosing yes or no for whether they have used AI for finance tasks
- **THEN** the system rejects the submission with a validation message indicating the field is required
- **AND** the system does NOT default the value to `false` or to any other choice

#### Scenario: Age range options are the four standard buckets
- **WHEN** the participant background form renders
- **THEN** the age-range options are exactly `20-24 歲`, `25-29 歲`, `30-39 歲`, and `40 歲以上`
- **AND** the age-range options do NOT include `under_20` or any `prefer_not_to_say` value

#### Scenario: Education level options are the three standard buckets
- **WHEN** the participant background form renders
- **THEN** the education-level options are exactly `大學在學`, `大學畢業`, and `研究所在學或以上`
- **AND** the education-level options do NOT include `high_school_or_below` or any `prefer_not_to_say` value

#### Scenario: Main domain options are the three standard buckets
- **WHEN** the participant background form renders
- **THEN** the main-domain options are exactly the values mapped to `finance_related`, `business_non_finance`, and `other`
- **AND** the main-domain options do NOT include any student/working split, any `prefer_not_to_say` value, or the legacy four-way `financeBackgroundType` enum values

#### Scenario: AI usage frequency options are the four standard buckets
- **WHEN** the participant background form renders
- **THEN** the AI-usage-frequency options are exactly the values mapped to `never`, `occasional`, `frequent`, and `daily`
- **AND** the AI-usage-frequency options do NOT include the legacy five-level `llmExperience` `rare` / `monthly` / `weekly` enum literals

#### Scenario: Removed legacy fields are rejected on submit
- **WHEN** a client submits a profile body that includes any of `gender`, `gradeOrOccupation`, `financeWorkExperience`, `investmentExperience`, `financeFamiliarity`, `financeSubdomains`, `notes`, `knownName`, `llmExperience`, `financeBackgroundType`, or any legacy key (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, `financeLlmUsage`)
- **THEN** the server SHALL strip those keys from the persisted profile object
- **AND** the persisted profile object SHALL contain only the six current keys (`token`, `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, `hasUsedAiForFinance`)

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
The system SHALL store each answered question with participant token, participant profile composed of the five current background fields (`ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, `hasUsedAiForFinance`), question metadata, blinded answers, hidden mapping, overall best and worst labels, facet-best labels for correctness, completeness, and readability, reasons, worst-answer quality flags, timestamp, response latency, and completion status. The system SHALL NOT require a `reasoning` facet-best label on newly stored records.

#### Scenario: Question judgment saved
- **WHEN** the participant saves a valid comparative judgment after completing the five-field profile
- **THEN** the system persists a complete evaluation record through a server API route including a participant profile snapshot whose keys are exactly `token`, `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, and `hasUsedAiForFinance`
- **AND** the persisted record's `facetSelections` keys are exactly `correctness`, `completeness`, and `readability`
- **AND** the persisted record's participant profile snapshot SHALL NOT contain any of `gender`, `gradeOrOccupation`, `financeWorkExperience`, `investmentExperience`, `financeFamiliarity`, `financeSubdomains`, `notes`, `knownName`, `llmExperience`, `financeBackgroundType`, or any legacy key

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page at `/admin` organized as a Tabbed Single Page research console with seven tabs — `總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料` — and a persistent KPI bar at the top showing participant count, completion count, question record count, completion percentage, and a three-bucket main-domain breakdown derived from `mainDomain`. Each tab SHALL be navigable via the `tab` URL search parameter so admins can deep-link.

#### Scenario: Admin reviews participant status table
- **WHEN** the `受測者` tab is active
- **THEN** the page lists each participant with the following columns in order: token, age range, education level, main domain (label), AI usage frequency (label), whether they have used AI for finance tasks (Y/N), completion status, and answered-count over question limit
- **AND** the page does NOT render any column for gender, finance familiarity, investment experience, finance work or internship experience, finance subdomain selections, grade or occupation, participant-side notes, or any legacy field (`fieldOrWorkDomain`, `isBusinessOrFinance`, `hasTakenFinanceCourse`, finance-LLM-usage 5-level enum)

#### Scenario: KPI bar reports main-domain breakdown
- **WHEN** the admin opens any admin tab
- **THEN** the KPI bar derives the main-domain breakdown by counting participants whose `mainDomain` is `finance_related` as the finance-related group, participants whose `mainDomain` is `business_non_finance` as the business-non-finance group, and participants whose `mainDomain` is `other` as the other-domain group
- **AND** the KPI bar SHALL NOT render an `unknown` bucket, a `refusal` bucket, or any bucket derived from the removed `financeBackgroundType` 5-value enum

#### Scenario: Admin inspects a record detail
- **WHEN** the admin clicks a row in the question records list
- **THEN** the page opens a side drawer showing the full user question text, the five-field participant profile snapshot (`ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, `hasUsedAiForFinance`), all facet selections, worst-answer flags, hidden model mapping, and any reason text for that record
- **AND** the drawer SHALL NOT render any legacy section, any `legacy` field prefix, or any field outside the five-field profile snapshot

### Requirement: Data export
The system SHALL allow admin users to export evaluation data as JSON and CSV, including comparative facet selections, resolved model IDs, and the current five-field participant profile.

#### Scenario: CSV export requested
- **WHEN** an admin requests CSV export
- **THEN** the system returns one row per answered question with selected labels, facet labels, resolved model IDs, reasons, worst-answer flags, and exactly six active-profile columns covering `token`, `age_range`, `education_level`, `main_domain`, `ai_usage_frequency`, and `has_used_ai_for_finance`
- **AND** the CSV header SHALL NOT contain any column named `gender`, `grade_or_occupation`, `finance_work_experience`, `investment_experience`, `finance_familiarity`, `finance_subdomains`, `notes`, `known_name`, `llm_experience`, `finance_background_type`, `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, or `legacy_finance_llm_usage`

#### Scenario: JSON export uses single profile shape
- **WHEN** an admin requests JSON export
- **THEN** each record's `participantProfile` object SHALL contain exactly the keys `token`, `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, and `hasUsedAiForFinance`
- **AND** each record SHALL NOT contain a `legacyProfile` nested block, a `legacy` key prefix, or any field outside the five-field profile snapshot
- **AND** each participant entry's `profile` object SHALL also contain exactly those same six keys (when the participant has submitted a profile) and SHALL NOT contain a `legacyProfile` block

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
The participant-facing study intro, signature copy, page header, completion screen, and participant-facing component strings SHALL avoid researcher-only or method-specific terminology so participants are not led toward a particular model preference and so the underlying training method is not disclosed.

#### Scenario: Intro copy avoids researcher-only terms
- **WHEN** the participant entry page renders the active `study.intro.paragraphs` from runtime platform settings
- **THEN** none of the rendered paragraphs SHALL contain the strings `大型語言模型`, `APT`, `H1`, `H2`, `TAIDE`, `validation loss`, `validation roles`, `盲測`, `H1-base`, `H2-base`, `主要分層變項`, or `預先指定`
- **AND** the paragraphs SHALL refer to the system under evaluation as `金融語言模型` (or an equivalent finance-domain framing such as `金融腦`) rather than as a general-purpose model

#### Scenario: Signature title avoids exposing training method
- **WHEN** the participant entry page renders the active `study.signature.thesisTitle` from runtime platform settings
- **THEN** the rendered title SHALL NOT contain the strings `Augmentative`, `Residual`, `Adapter`, or `APT`

#### Scenario: Default config seeds neutral intro
- **WHEN** the repository default `web/config/evaluation.config.json` is used as the active platform settings source (no runtime settings file exists yet)
- **THEN** the default `study.intro` SHALL contain exactly four paragraphs ordered as (1) thank-you and finance-language-model study purpose, (2) flow description of 5 questions × 3 anonymous answers and correctness / completeness / readability rating, (3) duration of 8-12 minutes and content scope of background data plus 5 finance questions, (4) data use scope plus sensitive-data prohibition plus non-investment-advice disclaimer
- **AND** the default `study.intro.tasks` SHALL contain exactly three items describing the participant action sequence (enter a question, view three anonymous answers, choose overall better answer and rate three facets)
- **AND** the default `study.signature.thesisTitle` SHALL be a neutral Chinese title that satisfies the `Signature title avoids exposing training method` scenario

#### Scenario: Study title and root title avoid technical jargon
- **WHEN** the participant flow renders the active `study.title`, `study.rootTitle`, or `study.eyebrow` from runtime platform settings
- **THEN** none of those three fields SHALL contain the string `盲測` or the standalone English word `Blind`
- **AND** the default values for those fields in `web/config/evaluation.config.json` SHALL satisfy the same forbidden-term constraint

#### Scenario: Completion screen avoids technical jargon
- **WHEN** the participant completion page renders the active `study.completion.title`, `study.completion.description`, or any item in `study.completion.notes` from runtime platform settings
- **THEN** none of those fields SHALL contain the string `盲測`
- **AND** the default values for those fields in `web/config/evaluation.config.json` SHALL satisfy the same forbidden-term constraint

#### Scenario: Participant-facing component strings avoid technical jargon
- **WHEN** the participant flow renders any string that is hard-coded into the participant-facing React components (`web/components/evaluation/token-entry.tsx`, `web/components/evaluation/profile-form.tsx`, or `web/components/evaluation/question-flow.tsx`) — including visible text, button labels, accessibility labels, and placeholders
- **THEN** none of those component sources SHALL contain the string `盲測` or the standalone English word `Blind` (case-insensitive)
- **AND** this constraint SHALL be enforced by a regression test that reads the three component files via the filesystem and asserts neither forbidden term appears in their source

#### Scenario: Page metadata avoids technical jargon
- **WHEN** any participant-visible page is rendered by the Next.js App Router (the root layout at `web/app/layout.tsx` is the source of the HTML `<title>` element and the `<meta name="description">` tag for every route in the participant flow)
- **THEN** neither the `metadata.title` nor the `metadata.description` exported from `web/app/layout.tsx` SHALL contain the string `盲測` or the standalone English word `Blind` (case-insensitive — both `Blind` and `blind` are forbidden, since the leak surfaces in the browser tab, bookmark titles, OG / link-preview cards, and search-engine indexing)
- **AND** this constraint SHALL be enforced by the same source-file regression test that scans the participant components, with `web/app/layout.tsx` added to its file list

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

### Requirement: Answer comparison presentation

The system SHALL present the generated A/B/C answers to the participant through a single uniform display pipeline so that no answer gains a presentation advantage in the blind comparison. The system SHALL render each answer's text as Markdown (GitHub-flavored), applying the identical renderer and styles to every answer label. The renderer SHALL preserve single-newline line breaks so existing plain-text answers (full-width numbered lists with single newlines between items) keep their original line structure. The system SHALL normalize each answer's text before rendering by trimming leading and trailing whitespace and collapsing runs of three or more consecutive newlines into a single blank line. Answer card content SHALL be top-aligned within the card regardless of answer length, so a shorter answer does not render with a large empty gap below its label. Rendered media and long unbroken tokens SHALL be constrained to the card's width so that one answer cannot blow out its card relative to the others and leak a presentation cue into the blind comparison.

#### Scenario: All answers rendered through the same markdown pipeline
- **WHEN** the comparison panel renders answers A, B, and C
- **THEN** every answer label SHALL be rendered with the same Markdown renderer and the same styles
- **AND** no answer SHALL be rendered as raw text while another is rendered as formatted markdown

#### Scenario: Markdown content is formatted
- **WHEN** a model answer contains Markdown syntax such as bold, headings, ordered or unordered lists, or tables
- **THEN** that syntax SHALL be rendered as formatted HTML rather than shown as literal markup characters

#### Scenario: Plain-text single newlines preserved
- **WHEN** an answer is plain text containing single newlines between numbered list items (e.g. `1. …\n2. …`)
- **THEN** each line SHALL render on its own line rather than being collapsed onto one line

#### Scenario: Whitespace runs normalized
- **WHEN** an answer contains leading/trailing whitespace or three or more consecutive newlines
- **THEN** the displayed answer SHALL have leading/trailing whitespace removed and runs of three or more newlines collapsed to a single blank line

#### Scenario: Short answer is top-aligned
- **WHEN** one answer card holds noticeably less content than the others
- **THEN** that card's text SHALL begin directly below its label with no large empty gap injected between the label and the text

#### Scenario: Rendered media does not blow out a card
- **WHEN** a model answer contains an image, a long unbroken token (e.g. a long URL), or wide content such as a table
- **THEN** the image SHALL be constrained to at most the card's width, the long token SHALL wrap, and a wide table SHALL scroll within the card
- **AND** the card content SHALL NOT expand the card beyond its grid column relative to the other answers

### Requirement: Answer generation loading feedback

The system SHALL display a visible loading indicator to the participant while the server generates the three answers after a question is submitted. The comparison panel SHALL remain hidden until all three answers are available (the answers route returns all three in one response), and during that wait the system SHALL show a centered spinner together with a textual message indicating that answers are being generated and a short wait is expected. While generation is in flight the question input and example controls SHALL remain disabled, and the loading indicator SHALL be removed once answers arrive or the request fails.

#### Scenario: Loading indicator shown during generation
- **WHEN** the participant submits a valid question and the answers request is in flight
- **THEN** the system SHALL display a centered spinner and a message such as "正在產生回答，約需數秒…"
- **AND** the comparison panel SHALL NOT be shown until the answers arrive

#### Scenario: Loading indicator cleared on completion
- **WHEN** the answers request resolves successfully
- **THEN** the spinner and loading message SHALL be removed
- **AND** the comparison panel with answers A/B/C SHALL be shown

#### Scenario: Loading indicator cleared on failure
- **WHEN** the answers request fails
- **THEN** the spinner and loading message SHALL be removed
- **AND** the participant SHALL remain able to retry from the question input

