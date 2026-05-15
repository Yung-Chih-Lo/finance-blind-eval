# Change: harden-invite-eval-platform

## Summary
Turn the blind-evaluation prototype into an invite-gated anonymous evaluation platform. The participant entry flow should require a researcher-issued invite code, create an anonymous participant session server-side, and stop accepting arbitrary `eval?token=` identifiers as authorization.

## Why
The previous token flow mixed entry authorization with participant identity. A public deployment could be abused by inventing tokens and calling the answer-generation API through the Next.js server. This change separates invite eligibility, httpOnly session authorization, and anonymous participant IDs.

## Scope
- Require invite-code redemption before profile or model-answer APIs can be used.
- Store only invite-code hashes in local data; emit plaintext codes only at generation time.
- Add admin tooling and a CLI script to generate invite codes plus QR-code links.
- Move study copy, prompt examples, labels, and limits into `web/config/evaluation.config.json`.
- Add basic admin protection for `/admin` and `/api/admin/*`.

## Non-Goals
- Replace local JSON persistence with a production database.
- Add full account login for participants.
- Add distributed rate limiting for multi-instance serverless deployment.
