## MODIFIED Requirements

### Requirement: Participant token entry
The system SHALL provide a participant evaluation entry route at `/` (root) that requires a researcher-distributed shared invite code before creating an anonymous participant session. The shared invite code SHALL be sourced from the `SHARED_INVITE_CODE` server environment variable. The route SHALL hard-block re-entry when a completion cookie (`eval_completed=1`) is present on the request. The entry page SHALL present a structured study briefing before the invite-code submit action, including study purpose, time/question scope, blind comparison tasks, privacy/sensitive-data guidance, and a non-investment-advice boundary.

#### Scenario: Study briefing shown before start
- **WHEN** a participant opens `/` without an `eval_completed` cookie
- **THEN** the entry page shows the study title, expected duration, question count, blind model-comparison task, privacy/sensitive-data warning, and non-investment-advice boundary before or alongside the invite-code form

### Requirement: Participant background form
The system SHALL require participants to submit non-identifying background data before answering guided evaluation questions, including broad demographic, education/work, finance experience, investment experience, LLM usage, and finance subdomain familiarity fields.

#### Scenario: Required background data missing
- **WHEN** a participant submits the background form without a required expanded profile field
- **THEN** the system prevents progression and displays a validation message

#### Scenario: Background data completed
- **WHEN** a participant submits business or finance background, age range, grade or occupation, field or work domain, finance course history, finance work experience, investment experience, finance familiarity, general LLM usage, finance-task LLM usage, and finance subdomain familiarity
- **THEN** the system stores the profile through a server API boundary and advances to question 1

#### Scenario: Existing session has legacy profile shape
- **WHEN** a participant has a saved profile that lacks the expanded analysis fields
- **THEN** the participant returns to the profile form with existing fields prefilled instead of advancing directly to the question flow

### Requirement: Evaluation record storage
The system SHALL store each answered question with participant token, participant profile including expanded non-identifying background fields, question metadata, blinded answers, hidden mapping, overall best and worst labels, facet-best labels for correctness, financial reasoning, completeness, and readability, reasons, worst-answer quality flags, timestamp, response latency, and completion status.

#### Scenario: Question judgment saved
- **WHEN** the participant saves a valid comparative judgment after completing the expanded profile
- **THEN** the system persists a complete evaluation record through a server API route including the participant profile snapshot

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page at `/admin` organized as a Tabbed Single Page research console with seven tabs — `總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料` — and a persistent KPI bar at the top showing participant count, completion count, question record count, completion percentage, and finance-vs-non-finance breakdown. Each tab SHALL be navigable via the `tab` URL search parameter so admins can deep-link.

#### Scenario: Admin reviews participant status table
- **WHEN** the `受測者` tab is active
- **THEN** the page lists each participant with token, finance background, age range, field/work domain, finance familiarity, finance-task LLM usage, completion status, and answered-count over question limit

#### Scenario: Admin inspects a record detail
- **WHEN** the admin clicks a row in the question records list
- **THEN** the page opens a side drawer showing the full user question text, participant profile snapshot, all facet selections, worst-answer flags, hidden model mapping, and any reason text for that record

### Requirement: Data export
The system SHALL allow admin users to export evaluation data as JSON and CSV, including comparative facet selections, resolved model IDs, and expanded participant profile fields.

#### Scenario: CSV export requested
- **WHEN** an admin requests CSV export
- **THEN** the system returns one row per answered question with selected labels, facet labels, resolved model IDs, reasons, worst-answer flags, and expanded non-identifying participant profile columns
