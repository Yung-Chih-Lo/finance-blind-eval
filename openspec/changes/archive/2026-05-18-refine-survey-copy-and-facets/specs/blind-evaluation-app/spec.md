## MODIFIED Requirements

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
