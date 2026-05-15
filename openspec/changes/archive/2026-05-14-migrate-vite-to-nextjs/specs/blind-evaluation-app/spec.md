## ADDED Requirements

### Requirement: Participant token entry
The system SHALL provide a participant evaluation entry route at `/eval` that allocates a random 6-digit participant token when the participant clicks start, while still accepting a token from the `token` query parameter for direct testing or resume links.

#### Scenario: Token provided in URL
- **WHEN** a participant opens `/eval?token=123456`
- **THEN** the system loads the participant flow using token `123456`

#### Scenario: Token missing from URL
- **WHEN** a participant opens `/eval` without a token query parameter
- **THEN** the system displays a start screen before showing the evaluation workflow

#### Scenario: Participant starts without preassigned token
- **WHEN** the participant clicks start from `/eval`
- **THEN** the system creates a random 6-digit participant token server-side and advances to the background form

### Requirement: Participant background form
The system SHALL require participants to submit background data before answering guided evaluation questions.

#### Scenario: Required background data missing
- **WHEN** a participant submits the background form without grade or occupation
- **THEN** the system prevents progression and displays a validation message

#### Scenario: Background data completed
- **WHEN** a participant submits business or finance background, grade or occupation, finance course history, finance familiarity, and LLM usage experience
- **THEN** the system stores the profile through a server API boundary and advances to question 1

### Requirement: Guided flexible prompt flow
The system SHALL present exactly five guided prompt categories for participant-authored finance questions.

#### Scenario: Participant starts question flow
- **WHEN** the participant completes the background form
- **THEN** the system displays question 1 of 5 with the first guided finance category

#### Scenario: Participant submits a short question
- **WHEN** the participant submits a question that fails the minimum completeness validation
- **THEN** the system rejects the submission and keeps the participant on the current question

### Requirement: Server-mediated model answer generation
The system SHALL generate answer A, answer B, and answer C through a Next.js server route instead of directly calling the model gateway from browser code.

#### Scenario: Answers requested
- **WHEN** the participant submits a valid guided question
- **THEN** the browser sends the question to a Next.js API route and receives only answer labels and answer text

#### Scenario: Gateway credentials required
- **WHEN** the gateway requires an API key
- **THEN** the API key is read only by server-side code and is not exposed to client bundles

### Requirement: Gateway model discovery
The system SHALL discover available models from the OpenAI-compatible gateway `/v1/models` endpoint before sending chat completion requests.

#### Scenario: Exactly three models available
- **WHEN** `/v1/models` returns exactly three model IDs
- **THEN** the server uses those three models for the blind comparison

#### Scenario: More than three models available
- **WHEN** `/v1/models` returns more than three model IDs
- **THEN** the server uses configured server-side model overrides or returns a configuration error

### Requirement: Hidden answer mapping
The system SHALL keep the mapping between A/B/C labels and real model IDs server-side.

#### Scenario: Participant receives answers
- **WHEN** the server returns answer A, answer B, and answer C to the browser
- **THEN** the response excludes real model IDs and hidden mapping data

#### Scenario: Admin reviews records
- **WHEN** an admin views per-question records
- **THEN** the system can show the hidden mapping for research analysis

### Requirement: Required blind comparison judgments
The system SHALL require a best answer, a worst answer, and at least one reason before saving a question judgment.

#### Scenario: Best or worst selection missing
- **WHEN** the participant attempts to save a judgment without selecting both best and worst answers
- **THEN** the system rejects the save and displays a validation message

#### Scenario: Reason missing
- **WHEN** the participant attempts to save a judgment with no best reason and no worst reason
- **THEN** the system rejects the save and displays a validation message

### Requirement: Evaluation record storage
The system SHALL store each answered question with participant token, participant profile, question metadata, blinded answers, hidden mapping, selections, reasons, quality flags, ratings, timestamp, response latency, and completion status.

#### Scenario: Question judgment saved
- **WHEN** the participant saves a valid judgment
- **THEN** the system persists a complete evaluation record through a server API route

#### Scenario: Fifth question saved
- **WHEN** the participant saves the fifth question judgment
- **THEN** the system marks the participant as completed and shows a thank-you page without model results

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page that summarizes participant completion, per-question records, and best/worst counts by model.

#### Scenario: Admin opens dashboard
- **WHEN** an admin opens `/admin`
- **THEN** the system displays participant count, completion count, question record count, and model best/worst counts

#### Scenario: Admin reviews question records
- **WHEN** question records exist
- **THEN** the admin page lists participant token, question index, prompt category, user question, selected best, selected worst, hidden mapping, and response latency

### Requirement: Data export
The system SHALL allow admin users to export evaluation data as JSON and CSV.

#### Scenario: JSON export requested
- **WHEN** an admin requests JSON export
- **THEN** the system returns participant statuses and evaluation records in JSON format

#### Scenario: CSV export requested
- **WHEN** an admin requests CSV export
- **THEN** the system returns one row per answered question with selected labels and resolved model IDs
