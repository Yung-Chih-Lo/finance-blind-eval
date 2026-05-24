## ADDED Requirements

### Requirement: Participant intro neutral terminology
The participant-facing study intro and signature copy SHALL avoid researcher-only or method-specific terminology so participants are not led toward a particular model preference and so the underlying training method is not disclosed.

#### Scenario: Intro copy avoids researcher-only terms
- **WHEN** the participant entry page renders the active `study.intro.paragraphs` from runtime platform settings
- **THEN** none of the rendered paragraphs SHALL contain the strings `大型語言模型`, `APT`, `H1`, `H2`, `TAIDE`, `validation loss`, `validation roles`, `盲測`, `H1-base`, `H2-base`, `主要分層變項`, or `預先指定`
- **AND** the paragraphs SHALL refer to the system under evaluation as `金融語言模型` (or an equivalent finance-domain framing) rather than as a general-purpose model

#### Scenario: Signature title avoids exposing training method
- **WHEN** the participant entry page renders the active `study.signature.thesisTitle` from runtime platform settings
- **THEN** the rendered title SHALL NOT contain the strings `Augmentative`, `Residual`, `Adapter`, or `APT`

#### Scenario: Default config seeds neutral intro
- **WHEN** the repository default `web/config/evaluation.config.json` is used as the active platform settings source (no runtime settings file exists yet)
- **THEN** the default `study.intro` SHALL contain exactly four paragraphs ordered as (1) thank-you and finance-language-model study purpose, (2) flow description of 5 questions × 3 anonymous answers and correctness / completeness / readability rating, (3) duration of 8-12 minutes and content scope of background data plus 5 finance questions, (4) data use scope plus sensitive-data prohibition plus non-investment-advice disclaimer
- **AND** the default `study.intro.tasks` SHALL contain exactly three items describing the participant action sequence (enter a question, view three anonymous answers, choose overall better answer and rate three facets)
- **AND** the default `study.signature.thesisTitle` SHALL be a neutral Chinese title that satisfies the `Signature title avoids exposing training method` scenario

### Requirement: Provider default system prompt finance-brain scope
The server-side `DEFAULT_SYSTEM_PROMPT` constant SHALL define the model as a finance-domain assistant (`金融語言模型` / `金融腦`) and SHALL instruct the model to refuse out-of-scope or real-time questions rather than answering them on best effort. The same default SHALL apply uniformly across all configured internal model IDs so that prompt-design differences do not contaminate the blind comparison.

#### Scenario: Default prompt declares finance-only scope
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL define the assistant as `金融語言模型` / `金融腦` (or equivalent wording)
- **AND** SHALL list at least the topical scope `金融`, `投資`, `財務`, `會計`, `總經`, `市場` as in-scope (the prompt may add others)
- **AND** SHALL instruct the model to politely refuse non-finance questions while explaining the service scope

#### Scenario: Default prompt refuses real-time / external-tool queries
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to decline questions that require real-time data (such as current quotes, today's market news, or live exchange rates) by explaining that the model cannot access live data, rather than fabricating a current value

#### Scenario: Default prompt forbids leaking evaluation metadata
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to NOT mention model names, the existence of blind testing, or `A`/`B`/`C` answer labels in its output

#### Scenario: Default prompt restricts investment-advice phrasing
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to decline giving specific buy / sell / hold instructions for individual securities while still allowing the model to explain concepts, frameworks, and risks

#### Scenario: Default prompt requires Traditional Chinese output
- **WHEN** `getDefaultProviderSettings()` returns the system prompt and the `OPENAI_COMPAT_SYSTEM_PROMPT` environment variable is not set
- **THEN** the returned `systemPrompt` SHALL instruct the model to respond in Traditional Chinese (`繁體中文`)

#### Scenario: Same default applies to all internal model IDs
- **WHEN** a server-side answer-generation call resolves provider settings via `normalizeProviderSettings` with no admin override of `systemPrompt`
- **THEN** the same default `systemPrompt` string SHALL be used for every internal model ID listed in `MODEL_IDS` (`H1-best`, `H2-best`, `TAIDE-baseline`)
- **AND** the provider settings shape SHALL NOT introduce per-model `systemPrompt` overrides in this change

### Requirement: Participant five-question completion gate
The system SHALL refuse to transition a participant's `completionStatus` to `"completed"` until that participant has saved exactly five evaluation records, and SHALL only emit the `eval_completed` cookie after that transition.

#### Scenario: Completion not granted before the fifth answered question
- **WHEN** a participant has saved one, two, three, or four evaluation records and submits another judgment for an in-progress question that would not become record number five
- **THEN** the server SHALL persist that record with `completionStatus = "answered"` for the record itself
- **AND** the participant's `ParticipantStatus.completionStatus` SHALL remain `"in_progress"` (not `"completed"`)
- **AND** the HTTP response SHALL NOT set the `eval_completed` cookie

#### Scenario: Completion granted on the fifth answered question
- **WHEN** a participant submits the judgment whose successful save brings their saved evaluation record count to exactly five
- **THEN** the server SHALL set the participant's `ParticipantStatus.completionStatus` to `"completed"`
- **AND** the HTTP response SHALL set the `eval_completed` cookie per the existing `Completion cookie issuance` requirement
- **AND** subsequent answer-generation calls for that participant token SHALL be rejected per the existing `Participant exceeds question limit` scenario

#### Scenario: Sixth record write is impossible
- **WHEN** a participant whose `completionStatus` already equals `"completed"` somehow reaches the answer-save endpoint with a sixth pending question
- **THEN** the server SHALL reject the save with a participant-exceeded-limit error and SHALL NOT persist a sixth record
