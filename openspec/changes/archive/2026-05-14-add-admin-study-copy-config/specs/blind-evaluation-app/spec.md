## ADDED Requirements

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
