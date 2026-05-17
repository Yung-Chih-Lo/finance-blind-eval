## ADDED Requirements

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

## MODIFIED Requirements

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
