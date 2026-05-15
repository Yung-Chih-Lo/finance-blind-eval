## File Plan

- Create `web/lib/server/admin-auth.ts` — admin token validation, session cookie creation, and session validation helpers.
- Create `web/app/api/admin/auth/exchange/route.ts` — exchange URL token for admin session cookie.
- Create `web/app/api/admin/auth/logout/route.ts` — clear admin session cookie.
- Modify `web/proxy.ts` — allow token exchange, accept admin session cookie, and keep Basic Auth fallback.
- Modify `web/app/admin/page.tsx` if needed — ensure token URLs redirect away before protected content is rendered.
- Modify `web/.env.example` — document admin token and session settings.
- Modify `web/README.md` and root `README.md` — document admin entry flow and deployment guidance.

## 1. Admin Auth Helpers

- [x] 1.1 Add `web/lib/server/admin-auth.ts` with constants for `admin_session` cookie name, cookie TTL, and production cookie flags.
- [x] 1.2 Implement admin URL token validation using `ADMIN_LINK_TOKEN_SHA256` when present and raw `ADMIN_LINK_TOKEN` as local/deployment fallback.
- [x] 1.3 Implement admin session cookie creation with an unguessable signed token or persisted session hash.
- [x] 1.4 Implement admin session validation that rejects missing, malformed, expired, or tampered cookies.
- [x] 1.5 Implement cookie clearing helper for logout.

## 2. Admin Auth Routes

- [x] 2.1 Add `POST /api/admin/auth/exchange` that accepts `{ token }`, validates it, sets the admin session cookie, and returns success.
- [x] 2.2 Add `GET /api/admin/auth/exchange?token=...` for direct magic-link entry, setting the cookie and redirecting to `/admin`.
- [x] 2.3 Ensure exchange responses never echo the submitted token.
- [x] 2.4 Add `POST /api/admin/auth/logout` that clears the admin session cookie and returns success.

## 3. Proxy Protection

- [x] 3.1 Update `web/proxy.ts` so `/api/admin/auth/exchange` can run without an existing admin session.
- [x] 3.2 Update `web/proxy.ts` so `/admin?token=...` redirects through the exchange flow before rendering admin content.
- [x] 3.3 Update `web/proxy.ts` so valid admin session cookies allow `/admin` and `/api/admin/*`.
- [x] 3.4 Keep existing Basic Auth behavior as fallback when `ADMIN_PASSWORD` is configured.
- [x] 3.5 Fail closed in production when neither admin token configuration nor `ADMIN_PASSWORD` is configured.
- [x] 3.6 Prevent open redirects by only redirecting successful exchanges to same-origin `/admin`.

## 4. Documentation And Config

- [x] 4.1 Add `ADMIN_LINK_TOKEN`, `ADMIN_LINK_TOKEN_SHA256`, and `ADMIN_SESSION_SECRET` examples to `web/.env.example`.
- [x] 4.2 Document how to create a local admin link such as `/admin?token=...`.
- [x] 4.3 Document that shared deployments should prefer hashed token configuration and HTTPS-only cookies.
- [x] 4.4 Document that Basic Auth remains a fallback, not the preferred platform admin entry.

## 5. Verification

- [x] 5.1 Run `cd web && npm run typecheck`.
- [x] 5.2 Run `cd web && npm run lint`.
- [x] 5.3 Run `cd web && npm run build`.
- [x] 5.4 Verify invalid `/admin?token=bad` does not render protected admin content.
- [x] 5.5 Verify valid `/admin?token=<token>` sets `admin_session` and redirects to `/admin`.
- [x] 5.6 Verify `/api/admin/invites` rejects requests without admin session or Basic Auth fallback.
- [x] 5.7 Verify `/api/admin/invites` accepts requests with a valid admin session cookie.
- [x] 5.8 Verify Basic Auth still allows admin access when `ADMIN_PASSWORD` is configured.

