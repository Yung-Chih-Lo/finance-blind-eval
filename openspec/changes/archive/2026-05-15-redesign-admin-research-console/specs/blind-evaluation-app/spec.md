## MODIFIED Requirements

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page at `/admin` organized as a Tabbed Single Page research console with seven tabs — `總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料` — and a persistent KPI bar at the top showing participant count, completion count, question record count, completion percentage, finance-vs-non-finance breakdown, and invite code count. Each tab SHALL be navigable via the `tab` URL search parameter so admins can deep-link.

#### Scenario: Admin opens dashboard
- **WHEN** an admin opens `/admin` without a `tab` query parameter
- **THEN** the system renders the KPI bar with the six participant/record metrics and selects the `總覽` tab by default

#### Scenario: Admin opens a specific tab via URL
- **WHEN** an admin opens `/admin?tab=models`
- **THEN** the system renders the same KPI bar and activates the `模型結果` tab

#### Scenario: Admin reviews participant funnel
- **WHEN** the `總覽` tab is active
- **THEN** the page displays a participant funnel visualizing five stages — Invited, Redeemed, Profile completed, Answered any question, Completed — each with absolute count and the percentage retained from the previous stage

#### Scenario: Admin reviews attention items
- **WHEN** the `總覽` tab is active and evaluation records exist
- **THEN** the page lists (a) the top three worst-answer flags by model, (b) records whose response latency exceeds the dataset p95, and (c) up to five stalled participants who started but have not completed

#### Scenario: Admin reviews model leaderboard
- **WHEN** the `總覽` tab or `模型結果` tab is active and evaluation records exist
- **THEN** the page renders a model leaderboard sorted by net (best − worst), with each row showing a proportional horizontal bar, best count, worst count, and net value rendered with a positive/negative badge

#### Scenario: Admin reviews model comparison table
- **WHEN** the `模型結果` tab is active and evaluation records exist
- **THEN** the page displays each model's overall best count, overall worst count, best-worst net score, and selections for correctness, financial reasoning, completeness, and readability, with numeric columns right-aligned

#### Scenario: Admin reviews question records list
- **WHEN** the `原始資料` tab is active and question records exist
- **THEN** the page lists each record as a row of participant token, question index, prompt category, selected overall best, selected overall worst, and response latency only — long-form fields are NOT rendered in the table

#### Scenario: Admin inspects a record detail
- **WHEN** the admin clicks a row in the question records list
- **THEN** the page opens a side drawer showing the full user question text, all facet selections, worst-answer flags, hidden model mapping, and any reason text for that record
- **AND** closing the drawer returns focus to the originating row

#### Scenario: Admin reviews participant status table
- **WHEN** the `受測者` tab is active
- **THEN** the page lists each participant with token, business-or-finance background, finance familiarity, LLM experience, completion status, and answered-count over question limit

#### Scenario: Admin manages invites
- **WHEN** the `邀請碼` tab is active
- **THEN** the page renders invite generation actions alongside the invite code count from the snapshot

#### Scenario: Admin edits provider settings
- **WHEN** the `Provider 設定` tab is active
- **THEN** the page renders the provider settings form unchanged from its previous behavior, wrapped in the admin Card surface

#### Scenario: Admin edits study copy
- **WHEN** the `問卷文案` tab is active
- **THEN** the page renders the study copy editor unchanged from its previous behavior, wrapped in the admin Card surface

#### Scenario: Admin views settings version
- **WHEN** any tab is active
- **THEN** the page surfaces the active settings version and source (`vN / source`) in the header region, not as a KPI tile
