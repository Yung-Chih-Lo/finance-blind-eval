## MODIFIED Requirements

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
The system SHALL provide an admin page that summarizes participant completion, per-question records, overall best/worst counts by model, and facet-level comparative counts by model.

#### Scenario: Admin opens dashboard
- **WHEN** an admin opens `/admin`
- **THEN** the system displays participant count, completion count, question record count, and model-level counts for overall and facet selections

#### Scenario: Admin reviews model comparison
- **WHEN** evaluation records exist
- **THEN** the admin page displays each model's overall best count, overall worst count, best-worst net score, and selections for correctness, financial reasoning, completeness, and readability

#### Scenario: Admin reviews question records
- **WHEN** question records exist
- **THEN** the admin page lists participant token, question index, prompt category, user question, selected overall best, selected overall worst, facet selections, hidden mapping, and response latency

### Requirement: Data export
The system SHALL allow admin users to export evaluation data as JSON and CSV, including comparative facet selections and resolved model IDs.

#### Scenario: JSON export requested
- **WHEN** an admin requests JSON export
- **THEN** the system returns participant statuses and evaluation records in JSON format with comparative judgment fields

#### Scenario: CSV export requested
- **WHEN** an admin requests CSV export
- **THEN** the system returns one row per answered question with selected labels, facet labels, resolved model IDs, reasons, and worst-answer flags
