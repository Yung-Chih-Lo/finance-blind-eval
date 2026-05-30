## ADDED Requirements

### Requirement: Answer comparison presentation

The system SHALL present the generated A/B/C answers to the participant through a single uniform display pipeline so that no answer gains a presentation advantage in the blind comparison. The system SHALL render each answer's text as Markdown (GitHub-flavored), applying the identical renderer and styles to every answer label. The renderer SHALL preserve single-newline line breaks so existing plain-text answers (full-width numbered lists with single newlines between items) keep their original line structure. The system SHALL normalize each answer's text before rendering by trimming leading and trailing whitespace and collapsing runs of three or more consecutive newlines into a single blank line. Answer card content SHALL be top-aligned within the card regardless of answer length, so a shorter answer does not render with a large empty gap below its label. Rendered media and long unbroken tokens SHALL be constrained to the card's width so that one answer cannot blow out its card relative to the others and leak a presentation cue into the blind comparison.

#### Scenario: All answers rendered through the same markdown pipeline
- **WHEN** the comparison panel renders answers A, B, and C
- **THEN** every answer label SHALL be rendered with the same Markdown renderer and the same styles
- **AND** no answer SHALL be rendered as raw text while another is rendered as formatted markdown

#### Scenario: Markdown content is formatted
- **WHEN** a model answer contains Markdown syntax such as bold, headings, ordered or unordered lists, or tables
- **THEN** that syntax SHALL be rendered as formatted HTML rather than shown as literal markup characters

#### Scenario: Plain-text single newlines preserved
- **WHEN** an answer is plain text containing single newlines between numbered list items (e.g. `1. …\n2. …`)
- **THEN** each line SHALL render on its own line rather than being collapsed onto one line

#### Scenario: Whitespace runs normalized
- **WHEN** an answer contains leading/trailing whitespace or three or more consecutive newlines
- **THEN** the displayed answer SHALL have leading/trailing whitespace removed and runs of three or more newlines collapsed to a single blank line

#### Scenario: Short answer is top-aligned
- **WHEN** one answer card holds noticeably less content than the others
- **THEN** that card's text SHALL begin directly below its label with no large empty gap injected between the label and the text

#### Scenario: Rendered media does not blow out a card
- **WHEN** a model answer contains an image, a long unbroken token (e.g. a long URL), or wide content such as a table
- **THEN** the image SHALL be constrained to at most the card's width, the long token SHALL wrap, and a wide table SHALL scroll within the card
- **AND** the card content SHALL NOT expand the card beyond its grid column relative to the other answers

### Requirement: Answer generation loading feedback

The system SHALL display a visible loading indicator to the participant while the server generates the three answers after a question is submitted. The comparison panel SHALL remain hidden until all three answers are available (the answers route returns all three in one response), and during that wait the system SHALL show a centered spinner together with a textual message indicating that answers are being generated and a short wait is expected. While generation is in flight the question input and example controls SHALL remain disabled, and the loading indicator SHALL be removed once answers arrive or the request fails.

#### Scenario: Loading indicator shown during generation
- **WHEN** the participant submits a valid question and the answers request is in flight
- **THEN** the system SHALL display a centered spinner and a message such as "正在產生回答，約需數秒…"
- **AND** the comparison panel SHALL NOT be shown until the answers arrive

#### Scenario: Loading indicator cleared on completion
- **WHEN** the answers request resolves successfully
- **THEN** the spinner and loading message SHALL be removed
- **AND** the comparison panel with answers A/B/C SHALL be shown

#### Scenario: Loading indicator cleared on failure
- **WHEN** the answers request fails
- **THEN** the spinner and loading message SHALL be removed
- **AND** the participant SHALL remain able to retry from the question input
