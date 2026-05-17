## MODIFIED Requirements

### Requirement: Participant token entry
The system SHALL provide a participant evaluation entry route at `/` (root) that requires a researcher-distributed shared invite code before creating an anonymous participant session. The shared invite code SHALL be sourced from the `SHARED_INVITE_CODE` server environment variable. The route SHALL hard-block re-entry when a completion cookie (`eval_completed=1`) is present on the request.

#### Scenario: Invite code entered
- **WHEN** a participant opens `/` without an `eval_completed` cookie and enters a value matching `SHARED_INVITE_CODE`
- **THEN** the system creates an anonymous participant token (`P-XXXXXXXX`) and an httpOnly session cookie
- **AND** advances to the background form

#### Scenario: Invite query provided
- **WHEN** a participant opens `/?invite_code=ailab502` without an `eval_completed` cookie
- **THEN** the system pre-fills the invite-code field with the URL value without treating that string as a participant identity

#### Scenario: Invite code mismatch
- **WHEN** a participant submits an invite code value that does not match `SHARED_INVITE_CODE`
- **THEN** the system rejects the redeem request with a 403 response and SHALL NOT create a participant or session

#### Scenario: Shared invite code not configured
- **WHEN** the server receives a redeem request while `SHARED_INVITE_CODE` is unset or empty
- **THEN** the system returns 503 with a service-configuration error message and SHALL NOT create a participant or session

#### Scenario: Re-entry blocked by completion cookie
- **WHEN** a participant opens `/` with an `eval_completed=1` cookie present
- **THEN** the page server-side renders a "已完成測驗" terminal view that does NOT show the invite-code input or the start button

#### Scenario: Server-side re-entry guard
- **WHEN** a `POST /api/session/redeem-invite` request arrives carrying an `eval_completed=1` cookie
- **THEN** the API rejects the request with 403 before evaluating the invite code

#### Scenario: Arbitrary participant token in URL
- **WHEN** a participant opens `/?token=123456`
- **THEN** the system SHALL NOT use that token as authorization or create a participant from it

### Requirement: Admin evaluation dashboard
The system SHALL provide an admin page at `/admin` organized as a Tabbed Single Page research console with seven tabs — `總覽 / 受測者 / 模型結果 / 邀請碼 / Provider 設定 / 問卷文案 / 原始資料` — and a persistent KPI bar at the top showing participant count, completion count, question record count, completion percentage, and finance-vs-non-finance breakdown. Each tab SHALL be navigable via the `tab` URL search parameter so admins can deep-link.

#### Scenario: Admin opens dashboard
- **WHEN** an admin opens `/admin` without a `tab` query parameter
- **THEN** the system renders the KPI bar with the participant/record metrics and selects the `總覽` tab by default

#### Scenario: Admin opens a specific tab via URL
- **WHEN** an admin opens `/admin?tab=models`
- **THEN** the system renders the same KPI bar and activates the `模型結果` tab

#### Scenario: Admin reviews participant funnel
- **WHEN** the `總覽` tab is active
- **THEN** the page displays a participant funnel visualizing four stages — Redeemed, Profile completed, Answered any question, Completed — each with absolute count and the percentage retained from the previous stage

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

#### Scenario: Admin views the shared invite code
- **WHEN** the `邀請碼` tab is active and `SHARED_INVITE_CODE` is configured
- **THEN** the page renders the configured invite code as read-only text alongside a QR-code image whose payload is `${origin}/?invite_code=<code>` and a download action for the QR image
- **AND** the page SHALL NOT render any invite-generation form or batch-creation action

#### Scenario: Admin views the invite tab without configuration
- **WHEN** the `邀請碼` tab is active and `SHARED_INVITE_CODE` is unset or empty
- **THEN** the page renders a warning that the shared invite code is not configured and SHALL NOT render a QR image

#### Scenario: Admin edits provider settings
- **WHEN** the `Provider 設定` tab is active
- **THEN** the page renders the provider settings form unchanged from its previous behavior, wrapped in the admin Card surface

#### Scenario: Admin edits study copy
- **WHEN** the `問卷文案` tab is active
- **THEN** the page renders the study copy editor unchanged from its previous behavior, wrapped in the admin Card surface

#### Scenario: Admin views settings version
- **WHEN** any tab is active
- **THEN** the page surfaces the active settings version and source (`vN / source`) in the header region, not as a KPI tile

### Requirement: Server-mediated model answer generation
The system SHALL generate answer A, answer B, and answer C through a Next.js server route only after validating the active participant session and active provider settings.

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

## ADDED Requirements

### Requirement: Completion cookie issuance
When a participant transitions to `completionStatus = "completed"`, the system SHALL set a cookie that allows server-side re-entry blocking on subsequent visits to the participant entry route.

#### Scenario: Completion cookie set on final question
- **WHEN** the server records the participant's final answer such that `completionStatus` becomes `"completed"`
- **THEN** the same HTTP response SHALL set a cookie named `eval_completed` with value `"1"`, `Max-Age=31536000`, `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` in production

#### Scenario: Completion cookie not set before completion
- **WHEN** the server records an answer that does NOT transition the participant to completed status
- **THEN** the response SHALL NOT set the `eval_completed` cookie

## REMOVED Requirements

### Requirement: Invite and QR administration
**Reason**: 共用邀請碼後無批次產生需求；admin 改顯示唯讀的環境變數值與單一 QR。批次產生 CLI 也一併移除。
**Migration**: 設定 `SHARED_INVITE_CODE` 環境變數即可；既有 `.data/invite-qr/` 目錄與 `invites` 欄位將被忽略，可手動清空。
