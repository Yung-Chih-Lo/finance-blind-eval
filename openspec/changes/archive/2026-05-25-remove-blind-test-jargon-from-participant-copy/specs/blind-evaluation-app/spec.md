## MODIFIED Requirements

### Requirement: Participant intro neutral terminology
The participant-facing study intro, signature copy, page header, completion screen, and participant-facing component strings SHALL avoid researcher-only or method-specific terminology so participants are not led toward a particular model preference and so the underlying training method is not disclosed.

#### Scenario: Intro copy avoids researcher-only terms
- **WHEN** the participant entry page renders the active `study.intro.paragraphs` from runtime platform settings
- **THEN** none of the rendered paragraphs SHALL contain the strings `大型語言模型`, `APT`, `H1`, `H2`, `TAIDE`, `validation loss`, `validation roles`, `盲測`, `H1-base`, `H2-base`, `主要分層變項`, or `預先指定`
- **AND** the paragraphs SHALL refer to the system under evaluation as `金融語言模型` (or an equivalent finance-domain framing such as `金融腦`) rather than as a general-purpose model

#### Scenario: Signature title avoids exposing training method
- **WHEN** the participant entry page renders the active `study.signature.thesisTitle` from runtime platform settings
- **THEN** the rendered title SHALL NOT contain the strings `Augmentative`, `Residual`, `Adapter`, or `APT`

#### Scenario: Default config seeds neutral intro
- **WHEN** the repository default `web/config/evaluation.config.json` is used as the active platform settings source (no runtime settings file exists yet)
- **THEN** the default `study.intro` SHALL contain exactly four paragraphs ordered as (1) thank-you and finance-language-model study purpose, (2) flow description of 5 questions × 3 anonymous answers and correctness / completeness / readability rating, (3) duration of 8-12 minutes and content scope of background data plus 5 finance questions, (4) data use scope plus sensitive-data prohibition plus non-investment-advice disclaimer
- **AND** the default `study.intro.tasks` SHALL contain exactly three items describing the participant action sequence (enter a question, view three anonymous answers, choose overall better answer and rate three facets)
- **AND** the default `study.signature.thesisTitle` SHALL be a neutral Chinese title that satisfies the `Signature title avoids exposing training method` scenario

#### Scenario: Study title and root title avoid technical jargon
- **WHEN** the participant flow renders the active `study.title`, `study.rootTitle`, or `study.eyebrow` from runtime platform settings
- **THEN** none of those three fields SHALL contain the string `盲測` or the standalone English word `Blind`
- **AND** the default values for those fields in `web/config/evaluation.config.json` SHALL satisfy the same forbidden-term constraint

#### Scenario: Completion screen avoids technical jargon
- **WHEN** the participant completion page renders the active `study.completion.title`, `study.completion.description`, or any item in `study.completion.notes` from runtime platform settings
- **THEN** none of those fields SHALL contain the string `盲測`
- **AND** the default values for those fields in `web/config/evaluation.config.json` SHALL satisfy the same forbidden-term constraint

#### Scenario: Participant-facing component strings avoid technical jargon
- **WHEN** the participant flow renders any string that is hard-coded into the participant-facing React components (`web/components/evaluation/token-entry.tsx`, `web/components/evaluation/profile-form.tsx`, or `web/components/evaluation/question-flow.tsx`) — including visible text, button labels, accessibility labels, and placeholders
- **THEN** none of those component sources SHALL contain the string `盲測` or the standalone English word `Blind` (case-insensitive)
- **AND** this constraint SHALL be enforced by a regression test that reads the three component files via the filesystem and asserts neither forbidden term appears in their source

#### Scenario: Page metadata avoids technical jargon
- **WHEN** any participant-visible page is rendered by the Next.js App Router (the root layout at `web/app/layout.tsx` is the source of the HTML `<title>` element and the `<meta name="description">` tag for every route in the participant flow)
- **THEN** neither the `metadata.title` nor the `metadata.description` exported from `web/app/layout.tsx` SHALL contain the string `盲測` or the standalone English word `Blind` (case-insensitive — both `Blind` and `blind` are forbidden, since the leak surfaces in the browser tab, bookmark titles, OG / link-preview cards, and search-engine indexing)
- **AND** this constraint SHALL be enforced by the same source-file regression test that scans the participant components, with `web/app/layout.tsx` added to its file list
