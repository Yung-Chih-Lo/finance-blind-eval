# Design

## Architecture
The evaluation platform now separates three concepts:

- **Invite code**: researcher-issued entry credential. It is redeemed once or up to `maxUses`.
- **Session cookie**: httpOnly browser session proving that invite redemption succeeded.
- **Participant token**: anonymous research identifier shown in the UI and persisted with records.

The browser no longer authorizes itself by passing `token` in a URL or API body. Participant APIs resolve the active participant from the server-side session cookie.

## Invite Storage
Invite records are stored in the same local JSON store as pilot evaluation data:

- `codeHash`: SHA-256 hash of the normalized invite code.
- `maxUses` and `uses`: usage cap.
- `participantTokens`: anonymous participants created from the invite.

Plaintext invite codes are returned only during generation. The CLI writes a CSV and QR SVG files so researchers can distribute codes without storing plaintext in the application config.

## Configuration
Public study content lives in `web/config/evaluation.config.json`:

- study copy and signature
- completion text
- prompt categories and five example questions per page
- answer labels and model IDs
- evaluation facets and worst-answer flags
- min/max question length, max questions, and rate-limit values

This file is safe to commit because it does not contain gateway secrets or live invite codes.

## Protection
The model gateway API key still protects the upstream gateway. The Next.js API is also protected by:

- invite-required session checks on profile, answer, and record APIs
- per-IP and per-session rate limits on invite redemption and answer generation
- max question count and question-length limits
- Basic Auth middleware for admin pages and admin APIs when `ADMIN_PASSWORD` is configured

The current rate limiter is in-memory and intended for a single Node process or pilot deployment. A production multi-instance deployment should move this to Redis/KV.
