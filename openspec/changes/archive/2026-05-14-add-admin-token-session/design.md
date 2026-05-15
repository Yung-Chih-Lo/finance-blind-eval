## Context

The app currently protects `/admin` and `/api/admin/*` in `web/proxy.ts` with Basic Auth when `ADMIN_PASSWORD` is configured. Local development allows admin access without a password, while production returns a configuration error when `ADMIN_PASSWORD` is missing.

The platform roadmap adds admin-editable provider endpoints, model candidates, and prompt settings. Those settings are more sensitive than invite generation or record export, so the admin entry flow should be upgraded before adding more controls.

## Goals / Non-Goals

**Goals:**

- Support `/admin?token=...` as a one-step admin entry URL.
- Exchange a valid URL token for an httpOnly admin session cookie.
- Redirect to `/admin` after exchange so the token is removed from the address bar.
- Protect `/admin` and `/api/admin/*` using the admin session.
- Preserve Basic Auth as a fallback for local recovery and simple deployments.

**Non-Goals:**

- Do not build model endpoint, provider, or prompt settings UI in this change.
- Do not introduce user accounts, OAuth, role-based access, or a database-backed admin table.
- Do not store admin secrets in client-side code or `NEXT_PUBLIC_*` variables.

## Decisions

### Use a server-side admin session cookie

After the URL token is accepted, the server will set an httpOnly cookie such as `admin_session`. Admin route protection will validate this cookie on future requests.

Rationale: this prevents the long-lived admin token from staying in the URL, browser history, and screenshots. It also gives later admin APIs one shared authentication path.

Alternative considered: keep checking `?token=` on every admin request. This is simpler but leaks the token through URLs and makes API calls awkward.

### Hash tokens before comparison

The server should support a hashed admin token environment variable, with raw-token fallback acceptable for local development. Token comparison should normalize only the outer whitespace and use timing-safe comparison when possible.

Rationale: deployments can avoid storing the plaintext admin link token in environment configuration.

Alternative considered: raw `ADMIN_LINK_TOKEN` only. This is easier to configure but weaker for open-source examples and shared deployment screenshots.

### Keep Basic Auth fallback

Basic Auth remains valid when `ADMIN_PASSWORD` is configured. Admin session cookies become the preferred path for URL-token entry, but Basic Auth keeps recovery simple.

Rationale: the current app already uses Basic Auth, and removing it would make local recovery harder while the settings platform is still file-backed.

### Exclude exchange endpoint from admin-session protection

`/api/admin/auth/exchange` must be reachable without an existing admin session so it can validate the URL token and create the session. All other admin APIs remain protected.

Rationale: the token exchange is the bootstrap endpoint.

## Risks / Trade-offs

- URL token may still appear in initial access logs -> redirect immediately after exchange and document that deployments should avoid sharing logs.
- File-backed/local deployments may restart and invalidate in-memory session state if sessions are not stateless -> use a signed or hashed cookie value that can be validated from env configuration, or persist only a hash under `.data` if session revocation is required later.
- Cross-site leakage through redirects -> use `SameSite=Lax`, `Secure` in production, and avoid redirecting to arbitrary `next` URLs.
- Missing admin configuration could accidentally expose admin in production -> production MUST fail closed when neither admin session token configuration nor Basic Auth configuration is available.

## Migration Plan

1. Add admin auth helpers for token validation, cookie creation, and cookie validation.
2. Add `/api/admin/auth/exchange` and `/api/admin/auth/logout`.
3. Update proxy/admin guard logic to accept either a valid admin session or Basic Auth fallback.
4. Update `/admin` entry handling so `?token=` is exchanged and then redirected away.
5. Update `.env.example` and README docs with token-generation and deployment guidance.

## Open Questions

- Should admin sessions be stateless signed cookies for v1, or persisted session hashes in `.data` to allow logout/revocation across a running server?
- Should local development continue allowing admin access with no configured auth, or should it warn visibly on the admin page?

