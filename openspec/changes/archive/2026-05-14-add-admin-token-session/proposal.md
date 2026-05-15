## Why

The admin surface will soon manage provider endpoints, model candidates, and prompt settings, so it needs a safer access flow before adding more high-impact controls. Basic Auth is useful as a fallback, but a shareable admin entry link should exchange once into a server-owned session and remove the token from the URL.

## What Changes

- Add a magic-link style admin entry flow for `/admin?token=...`.
- Exchange a valid admin URL token for an httpOnly admin session cookie.
- Redirect to `/admin` after exchange so the token is no longer visible in the browser URL.
- Require the admin session for `/admin` and `/api/admin/*`.
- Keep Basic Auth as a fallback for local development and recovery.
- Add environment configuration for the hashed or raw admin link token.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `blind-evaluation-app`: Extend admin access protection from Basic Auth only to admin token exchange plus httpOnly session protection.

## Impact

- `web/proxy.ts`: Admin route protection and token exchange routing.
- `web/lib/server/*`: Admin session token hashing, cookie helpers, and auth validation.
- `web/app/api/admin/*`: Admin APIs must accept only authenticated admin sessions or fallback Basic Auth.
- `web/app/admin/page.tsx`: Admin token URLs should exchange and redirect before rendering protected content.
- `web/.env.example` and docs: Add admin token/session configuration and operational guidance.

