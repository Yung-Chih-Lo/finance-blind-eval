## MODIFIED Requirements

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
- **THEN** the system returns one row per answered question with selected labels, facet labels, resolved model IDs, reasons, worst-answer flags, and exactly five active-profile columns covering token, age range, education level, main domain, AI usage frequency, and `hasUsedAiForFinance`
- **AND** the CSV header SHALL NOT contain any column named `gender`, `grade_or_occupation`, `finance_work_experience`, `investment_experience`, `finance_familiarity`, `finance_subdomains`, `notes`, `known_name`, `llm_experience`, `finance_background_type`, `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, or `legacy_finance_llm_usage`

#### Scenario: JSON export uses single profile shape
- **WHEN** an admin requests JSON export
- **THEN** each record's `participantProfile` object SHALL contain exactly the keys `token`, `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, and `hasUsedAiForFinance`
- **AND** each record SHALL NOT contain a `legacyProfile` nested block, a `legacy` key prefix, or any field outside the five-field profile snapshot
- **AND** each participant entry's `profile` object SHALL also contain exactly those same six keys (when the participant has submitted a profile) and SHALL NOT contain a `legacyProfile` block
