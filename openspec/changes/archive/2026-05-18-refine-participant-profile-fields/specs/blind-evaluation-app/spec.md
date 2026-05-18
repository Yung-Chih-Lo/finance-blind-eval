## MODIFIED Requirements

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
