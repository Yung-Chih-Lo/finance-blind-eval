## MODIFIED Requirements

### Requirement: Required blind comparison judgments
The system SHALL require participants to submit explicit overall comparative judgments whose target is an answer label, including overall best and overall worst, plus a full answer-score matrix for correctness, completeness, and readability before saving a question judgment. Each answer score SHALL be an integer from 1 to 5 for every displayed answer label. The system SHALL NOT require or accept facet-best label selections for correctness, completeness, or readability on newly saved records.

#### Scenario: Best or worst selection missing
- **WHEN** the participant attempts to save a judgment without selecting both overall best and overall worst answers
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Same answer selected as best and worst
- **WHEN** the participant attempts to save a judgment with the same answer selected as overall best and overall worst
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Answer score missing
- **WHEN** the participant attempts to save a judgment without scoring correctness, completeness, and readability for every displayed answer
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Facet-best selections not collected
- **WHEN** the question judgment screen renders
- **THEN** the system renders score controls for correctness, completeness, and readability under each answer label
- **AND** no facet-best A/B/C selector is rendered

#### Scenario: Reason missing
- **WHEN** the participant attempts to save a judgment with no best reason and no worst reason
- **THEN** the system rejects the save and displays a validation message

### Requirement: Evaluation record storage
The system SHALL store each answered question with participant token, participant profile composed of the five current background fields (`ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, `hasUsedAiForFinance`), question metadata, blinded answers, hidden mapping, overall best and worst labels, answer scores for correctness, completeness, and readability, reasons, worst-answer quality flags, timestamp, response latency, and completion status. The system SHALL NOT store new facet-best labels or quality-rating legacy fields on newly stored records.

#### Scenario: Question judgment saved
- **WHEN** the participant saves a valid comparative judgment after completing the five-field profile
- **THEN** the system persists a complete evaluation record through a server API route including a participant profile snapshot whose keys are exactly `token`, `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, and `hasUsedAiForFinance`
- **AND** the persisted record's `answerScores` object contains A, B, and C, each with `correctness`, `completeness`, and `readability` integer scores from 1 to 5
- **AND** the persisted record's participant profile snapshot SHALL NOT contain any of `gender`, `gradeOrOccupation`, `financeWorkExperience`, `investmentExperience`, `financeFamiliarity`, `financeSubdomains`, `notes`, `knownName`, `llmExperience`, `financeBackgroundType`, or any legacy key

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page at `/admin` organized as a Tabbed Single Page research console with seven tabs — `總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料` — and a persistent KPI bar at the top showing participant count, completion count, question record count, completion percentage, and a three-bucket main-domain breakdown derived from `mainDomain`. Each tab SHALL be navigable via the `tab` URL search parameter so admins can deep-link.

#### Scenario: Admin reviews model score results
- **WHEN** the `模型結果` tab is active
- **THEN** the page shows overall best, overall worst, and net counts for each model
- **AND** the page shows average correctness, average completeness, average readability, overall average score, and score sample count for each model

#### Scenario: Admin inspects a record detail
- **WHEN** the admin clicks a row in the question records list
- **THEN** the page opens a side drawer showing the full user question text, the five-field participant profile snapshot (`ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, `hasUsedAiForFinance`), all answer scores, worst-answer flags, hidden model mapping, and any reason text for that record
- **AND** the drawer SHALL NOT render any legacy section, any `legacy` field prefix, or any field outside the five-field profile snapshot

### Requirement: Data export
The system SHALL allow admin users to export evaluation data as JSON and CSV, including overall best/worst selections, answer scores, resolved model IDs, and the current five-field participant profile.

#### Scenario: CSV export requested
- **WHEN** an admin requests CSV export
- **THEN** the system returns one row per answered question with selected labels, A/B/C answer scores, resolved model score columns, resolved model IDs, reasons, worst-answer flags, and exactly six active-profile columns covering `token`, `age_range`, `education_level`, `main_domain`, `ai_usage_frequency`, and `has_used_ai_for_finance`
- **AND** the CSV header SHALL NOT contain any column named `gender`, `grade_or_occupation`, `finance_work_experience`, `investment_experience`, `finance_familiarity`, `finance_subdomains`, `notes`, `known_name`, `llm_experience`, `finance_background_type`, `legacy_field_or_work_domain`, `legacy_is_business_or_finance`, `legacy_has_taken_finance_course`, or `legacy_finance_llm_usage`
- **AND** the CSV header SHALL NOT contain any `best_by_*` facet-selection columns

#### Scenario: JSON export uses single profile shape
- **WHEN** an admin requests JSON export
- **THEN** each record's `participantProfile` object SHALL contain exactly the keys `token`, `ageRange`, `educationLevel`, `mainDomain`, `aiUsageFrequency`, and `hasUsedAiForFinance`
- **AND** each record SHALL NOT contain a `legacyProfile` nested block, a `legacy` key prefix, or any field outside the five-field profile snapshot
- **AND** each participant entry's `profile` object SHALL also contain exactly those same six keys (when the participant has submitted a profile) and SHALL NOT contain a `legacyProfile` block
