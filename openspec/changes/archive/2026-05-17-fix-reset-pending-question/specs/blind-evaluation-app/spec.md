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
