# Lore Web Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate Lore Web so `/auth` is the public entry page and every dashboard page/API requires an authorized browser session.

**Architecture:** Use a small middleware gate for page/API admission and a server-side auth helper that defines mode-specific session readiness. Admission is **default-deny**: every page and `/api/*` route is protected unless it appears on an explicit public allowlist. Move `/auth` out of the dashboard route group, keep NextAuth under `/api/auth/*`, and add a narrow public browser-session endpoint for local no-auth login, bearer-token login, and local sign-out. Security-sensitive logic (`safeAuthNextPath`, auth-mode precedence, cookie writing) lives in **one shared implementation** reused by the auth page, middleware, and both session endpoints. Dashboard pages and dashboard APIs stay unchanged except for being protected before they execute.

**Tech Stack:** Next.js 16 App Router, Next.js middleware, React 19, TypeScript, NextAuth v4 JWT sessions, zod, Vitest, Playwright.

## Design Decisions

These were resolved during design review and are binding for implementation:

1. **`authMode=none` is gated** with an explicit `Continue` action, even though it is the default mode. Be explicit in code comments and tests that the `none` gate is **UX/flow consistency, not a security boundary**: the `lore_web_local_auth` cookie is self-asserted by the same browser and grants no real authentication. The gate is only a meaningful security boundary for `bearer` and `oidc`, where a real credential is required.
2. **Default-deny classification.** All pages and `/api/*` routes are protected unless explicitly public. New routes are protected automatically. The classifier maintains a public allowlist (`/auth`, `/api/auth/*`, `/api/browser-session`, static assets), not a protected allowlist.
3. **Single shared implementation** of `safeAuthNextPath`, auth-mode resolution, and cookie writing. No duplicated copies in `auth-gate.ts` vs `auth-page.ts` vs the route handlers.
4. **Module placement for edge-safety.** The pure gate logic lives in `src/lib/auth-gate.ts` and cookie identity in `src/lib/session-cookies.ts` — both under `src/lib/` (not `src/server/`) so `import-boundary.test.ts`, which scans `src/**` except `src/server/**`, enforces that they never pull in gRPC/proto. The Node-only cookie writer (`src/server/write-session-cookies.ts`) uses `next/headers` and stays in `src/server/`. `safeAuthNextPath` becomes canonical in `auth-gate.ts`; `auth-page.ts` re-exports it.
5. **`page.tsx` redirects `/` → `/overview`, never `/auth`.** The default-deny gate already routes unauthenticated `/` to `/auth`, so the page only runs for authenticated users and must send them to the dashboard. Middleware omits the `next` param when the path is `/` to avoid an `/auth → / → /auth` hop.

---

## Non-Goals

- Do not change Lore server authentication or authorization.
- Do not add user accounts for `authMode=none`.
- Do not store bearer tokens in client-readable storage.
- Do not make implementation code changes on the design-only review branch.

## Required Behavior

- `/` is handled by the gate: an **unauthenticated** visit is redirected to `/auth` by middleware; an **authenticated** visit is redirected to `/overview` by `page.tsx`. (`page.tsx` itself must redirect to `/overview`, not `/auth` — see Task 4.)
- `/auth` is publicly reachable and is not rendered inside the dashboard shell.
- Protected dashboard pages include `/overview`, `/repositories`, nested repository pages, and `/settings`.
- Protected dashboard APIs include `/api/capabilities`, `/api/repositories`, nested repository APIs, and `/api/settings`.
- Public auth/session APIs include `/api/auth/*` for NextAuth and a new local browser-session endpoint used by `/auth`.
- `authMode=none` authorization requires a local session-only auth cookie created from `/auth`.
- `authMode=bearer` authorization requires a saved bearer token cookie.
- `authMode=oidc` authorization requires a NextAuth JWT session that contains an OIDC access token.
- Sign-out clears the active local session state and returns to `/auth`; OIDC sign-out also uses NextAuth sign-out.
- Unauthorized page requests redirect to `/auth?next=<safe-local-path>`.
- Unauthorized dashboard API requests return `401` JSON and do not call backend gRPC helpers.
- Routes not explicitly public are protected by default (default-deny); adding a new dashboard page or API requires no gate change.
- Changing `authMode` from `/settings` is allowed but may make the current session unauthorized (e.g. switching to `bearer` with no token, or `oidc` when unconfigured); in that case the next protected navigation returns the user to `/auth`. This interplay must be covered by a test.

## Route And Session Model

| Surface | Access | Notes |
| --- | --- | --- |
| `/` | Public redirect | Redirects to `/auth`, not `/overview`. |
| `/auth` | Public | Reads current settings/session state server-side and provides login/sign-out actions. |
| `/api/auth/*` | Public | Existing NextAuth routes. |
| `/api/browser-session` | Public | New narrow endpoint for no-auth local session, bearer save/clear, and local sign-out. |
| `/overview`, `/repositories/**`, `/settings`, any other non-public page | Protected (default-deny) | Middleware redirects unauthorized browsers to `/auth`. |
| `/api/capabilities`, `/api/repositories/**`, `/api/settings`, any other non-public `/api/*` | Protected (default-deny) | Middleware returns `401` JSON for unauthorized browsers. |

Classification is **default-deny**. The named protected routes above are illustrative, not exhaustive: the middleware treats every page and `/api/*` route as protected unless it is on the public allowlist (`/auth`, `/api/auth/*`, `/api/browser-session`, and static assets).

Use these cookies:

- Existing `lore_web_auth_mode` continues to select `none`, `bearer`, or `oidc` for the browser session.
- Existing `lore_web_bearer_token` remains HTTP-only and is sufficient authorization only when the selected auth mode is `bearer`.
- New `lore_web_local_auth` is HTTP-only, `SameSite=Lax`, `path=/`, `secure` in production, and session-only. It is sufficient authorization only when the selected auth mode is `none`.
- Existing NextAuth session cookies are sufficient authorization only when the selected auth mode is `oidc` and the JWT contains `accessToken`.

## Files To Touch During Implementation

- Keep `lore-web/src/app/page.tsx` redirecting `/` to `/overview` (the gate, not the page, sends unauthenticated visitors to `/auth`).
- Move/modify `lore-web/src/app/(dashboard)/auth/page.tsx` to `lore-web/src/app/auth/page.tsx`: make `/auth` a public route outside `AppShell`.
- Modify `lore-web/src/components/auth/auth-client.tsx`: add no-auth continue, bearer login, and mode-aware sign-out flows against the local browser-session endpoint. Its existing bearer save/clear currently POST to `/api/settings`; move them to `/api/browser-session` since `/api/settings` is now gated and `/auth` runs pre-authentication. (`auth-client` is used only by `/auth`, so this is safe; the `/settings` page keeps using `/api/settings`.)
- Create `lore-web/src/lib/auth-gate.ts`: pure, edge-safe helper (no `server-only`/`next/headers`/gRPC imports — middleware imports it) for safe `next` paths, default-deny route classification, auth-mode resolution, and mode-specific authorization checks. **Decision: it lives in `src/lib/`, not `src/server/`.** `import-boundary.test.ts` scans `src/**` *except* `src/server/**` for gRPC/proto imports, so placing it in `src/lib/` makes that test automatically enforce its edge-safety (no accidental gRPC/proto pull-in); a `src/server/` location would be exempt from that guarantee.
- Create `lore-web/src/middleware.ts`: enforce the auth gate for dashboard pages and dashboard APIs.
- Create `lore-web/src/app/api/browser-session/route.ts`: public endpoint for local session creation, bearer save/clear, and local sign-out.
- Modify `lore-web/src/lib/navigation.ts`: rename the "Auth" nav item to "Session" and group it separately as a session/sign-out entry linking to public `/auth`.
- Add/update unit tests under `lore-web/src/lib/*.test.ts` (auth-gate, session-cookies) and `lore-web/src/server/*.test.ts`, plus route tests under `lore-web/src/app/api/**/*.test.ts`.
- Add/update Playwright tests under `lore-web/tests/e2e/`.

## Implementation Tasks

### Task 1: Add Pure Auth Gate Rules

**Files:**
- Create: `lore-web/src/lib/auth-gate.ts`
- Create: `lore-web/src/lib/auth-gate.test.ts`
- Create: `lore-web/src/lib/session-cookies.ts` (edge-safe cookie identity: name constants + option presets)
- Create: `lore-web/src/lib/session-cookies.test.ts`

- [ ] In `src/lib/session-cookies.ts`, define the canonical cookie identity: move `SETTINGS_COOKIE_NAMES` here, add `LOCAL_AUTH_COOKIE_NAME = "lore_web_local_auth"`, and export the option presets (`SESSION_COOKIE_OPTIONS` = `{ httpOnly: true, sameSite: "lax", secure: NODE_ENV === "production", path: "/" }`, used for session-only cookies with no `maxAge`/`expires`). Keep this file free of `next/headers`/gRPC so it is edge-safe and importable by middleware. Re-export `SETTINGS_COOKIE_NAMES` from `settings.ts` so existing imports keep working. This is the single source of truth for cookie names and options — no other module re-declares them.
- [ ] **Make `safeAuthNextPath` the single shared copy.** Move the canonical implementation here (or into a shared module) and have `auth-page.ts` re-export it. Do **not** fork a second copy. `auth-page.ts` has no `server-only` import, so this module must also stay free of `server-only`/`next/headers` imports so middleware (edge/runtime) can import it. Keep the existing safety rules: local paths only, no protocol-relative URLs, no `/auth` loop, no `/api` targets.
- [ ] Define the public allowlist and a **default-deny** classifier: `isPublicPath(pathname)` returns true for `/auth`, `/api/auth/*`, `/api/browser-session`, and static assets; `requiresAuth(pathname)` returns `!isPublicPath(pathname)`. Provide `isApiPath(pathname)` (prefix `/api/`) so middleware can choose between a `401` (API) and a redirect (page) for protected routes. Do **not** enumerate protected routes.
- [ ] Define `resolveAuthMode(cookies, env)` so the browser `lore_web_auth_mode` cookie overrides `LORE_WEB_AUTH_MODE`. Accept already-read cookie values (a plain getter/map), not `next/headers`, so the function stays edge-safe. The cookie-over-env precedence currently lives inline in the callers (`session-settings.ts`, `request-context.ts`), not in `getServerConfig` (which is env-only). Route those callers and the middleware through this one helper; leave `getServerConfig`'s env-only signature unchanged.
- [ ] Define `hasAuthorizedBrowserSession({ authMode, hasLocalAuthCookie, hasBearerToken, hasOidcAccessToken })`:
  - `none`: true only with `lore_web_local_auth`.
  - `bearer`: true only with `lore_web_bearer_token`.
  - `oidc`: true only with a NextAuth JWT access token.
  - Note: `oidc` selected without a configured provider/secret can never be authorized; the user recovers by changing mode from `/settings` or `/auth`. Cover this case in tests.
- [ ] Unit test default-deny classification (including an unlisted route like `/api/future` and `/some-new-page` being treated as protected), public allowlist pass-through, safe `next` rejection, cookie/env auth-mode precedence, and all three authorization modes.

### Task 2: Add Middleware Gate

**Files:**
- Create: `lore-web/src/middleware.ts`
- Modify: `lore-web/src/lib/auth-gate.ts`
- Modify: `lore-web/src/lib/auth-gate.test.ts`

- [ ] Resolve auth mode via the shared `resolveAuthMode(request.cookies, env)`, then evaluate `hasAuthorizedBrowserSession`.
- [ ] **Only call `getToken` when `authMode === "oidc"` and a NextAuth secret is configured.** Mirror the existing guard in `getServerOidcAccessToken` (`server/auth.ts`): with no secret, `getToken` must not be called. For `none`/`bearer` (the common case, usually no `AUTH_SECRET`), skip `getToken` entirely so middleware never errors. Treat any `getToken` failure as "no token" rather than throwing.
- [ ] Add a `config.matcher` that runs middleware on everything except `/_next/*`, `/favicon.ico`, `/icon.svg`, and other static assets, so the gate cannot be skipped for a protected route. Use the shared `isPublicPath` for the remaining `/auth`, `/api/auth/*`, and `/api/browser-session` pass-throughs inside the handler.
- [ ] For unauthorized protected **pages** (`!isApiPath`), redirect to `/auth?next=<encoded-safe-path>` built from the current pathname+search via `safeAuthNextPath`. When the path is `/`, omit `next` entirely (a `next=/` would round-trip back through `page.tsx`); the post-login fallback `/overview` is the right destination.
- [ ] For unauthorized protected **APIs** (`isApiPath`), return `NextResponse.json({ error: "Authentication required" }, { status: 401 })`.
- [ ] Preserve the original request (`NextResponse.next()`) for authorized browsers and for public paths.
- [ ] Add tests for: page redirects, API 401 responses, public route pass-through, a previously-unlisted route being protected (default-deny), bearer cookie authorization, local no-auth cookie authorization, OIDC JWT authorization, and the no-secret path not invoking `getToken`.

### Task 3: Add Public Browser Session Endpoint

**Files:**
- Create: `lore-web/src/app/api/browser-session/route.ts`
- Create: `lore-web/src/server/write-session-cookies.ts` (Node-side helper that applies the `src/lib/session-cookies.ts` presets via `next/headers` `cookies()`; used by both this endpoint and `/api/settings`)
- Modify: `lore-web/src/server/settings.ts` (re-export cookie names from `src/lib/session-cookies.ts`; no duplicate constants)
- Modify: `lore-web/src/app/api/settings/route.ts` (use the shared write helper and add the origin check)
- Add: `lore-web/src/app/api/browser-session/route.test.ts`

- [ ] Add a zod request schema with explicit actions: `start-none-session`, `save-bearer`, `clear-bearer`, and `sign-out-local`.
- [ ] **Use the single shared write helper** `src/server/write-session-cookies.ts` for every cookie set/delete, applying the `SESSION_COOKIE_OPTIONS` preset from `src/lib/session-cookies.ts`. Both this endpoint and `/api/settings` go through it so they cannot diverge on `httpOnly`/`sameSite`/`secure`/`path` or session-vs-persistent options. `lore_web_local_auth` is written with the session preset (HTTP-only, `SameSite=Lax`, `path=/`, `secure` in production, no `maxAge`/`expires`).
- [ ] `start-none-session` sets `lore_web_auth_mode=none` and `lore_web_local_auth=1` as HTTP-only session cookies.
- [ ] `save-bearer` validates a non-empty bearer token, sets `lore_web_auth_mode=bearer`, stores `lore_web_bearer_token` as HTTP-only, and deletes `lore_web_local_auth` (modes are mutually exclusive).
- [ ] `clear-bearer` deletes `lore_web_bearer_token` **only**; it does not change `authMode` and is explicitly **not** sign-out. (Resetting to `none` would not authorize the session either — `none` without `lore_web_local_auth` is also unauthorized — so it adds branching with no benefit.) The session stays in `bearer` mode with no token; the `/auth` page already renders `bearerReady=false` and prompts for a token, and because the control lives on public `/auth` there is no redirect. Use the distinct `sign-out-local` action for actual logout. UI copy must frame "Clear bearer" as credential management, not sign-out.
- [ ] `sign-out-local` deletes `lore_web_local_auth` and `lore_web_bearer_token`; it does not attempt to clear NextAuth cookies.
- [ ] Return the same settings response shape that `/auth` already consumes (`readSessionSettingsResponse()`), without returning token values.
- [ ] CSRF: keep `SameSite=Lax` for transport-level protection **and** add a same-origin assertion. Add a pure `isSameOriginRequest({ origin, host })` to `src/lib/auth-gate.ts`: when an `Origin` header is present, its host must equal the request `Host`; when `Origin` is absent (non-browser clients), allow. Both `/api/browser-session` and `/api/settings` POST handlers call it and return `403 { error: "Cross-origin request rejected" }` on mismatch before any cookie write. No CSRF-token machinery — this matches the bar NextAuth sets for `/api/auth/*` and future-proofs non-localhost deployments. Unit-test the helper (present+match, present+mismatch, absent) and add a route test that a cross-origin POST is rejected.
- [ ] Test all cookie set/delete behavior, the mutual-exclusion of local-auth vs bearer, and invalid request handling.

### Task 4: Make `/auth` Public And `/` Redirect To It

**Files:**
- Modify: `lore-web/src/app/page.tsx`
- Move/modify: `lore-web/src/app/(dashboard)/auth/page.tsx` to `lore-web/src/app/auth/page.tsx`
- Modify: `lore-web/src/components/auth/auth-client.tsx`
- Modify: `lore-web/src/lib/navigation.ts`

- [ ] Keep `lore-web/src/app/page.tsx` as `redirect("/overview")`. Do **not** change it to `redirect("/auth")`: middleware (default-deny) already sends unauthenticated `/` visits to `/auth`, so the page only runs for authenticated users, who should land on the dashboard. Redirecting the page to `/auth` would bounce authenticated users off the dashboard and can cause an `/auth → / → /auth` hop.
- [ ] Move `/auth` out of `(dashboard)` so it no longer inherits `AppShell`. The standalone page loses the shell's chrome (sidebar/header), so give `/auth` its own minimal page wrapper. No `SessionProvider` is required: `auth-client.tsx` calls `signIn`/`signOut` from `next-auth/react` directly and never uses `useSession()` (OIDC session state arrives as a server prop), so these continue to work outside the dashboard tree.
- [ ] Keep server-side reads of `readSessionSettingsResponse()`, `getServerSession(authOptions)`, `buildAuthPageState()`, and `safeAuthNextPath()`.
- [ ] Add a primary `Continue` action for `authMode=none` that posts `start-none-session`, then routes to `nextPath ?? "/overview"`.
- [ ] In `authMode=bearer`, make saving a bearer token the login action; after success, route to `nextPath ?? "/overview"`.
- [ ] In `authMode=oidc`, call `signIn("oidc", { callbackUrl: nextPath ?? "/overview" })`.
- [ ] Make sign-out mode-aware:
  - `none`: post `sign-out-local`, then route to `/auth`.
  - `bearer`: post `sign-out-local`, then route to `/auth`.
  - `oidc`: call `signOut({ callbackUrl: "/auth" })`.
- [ ] Keep `/auth?next=/auth`, `/auth?next=/api/settings`, and external `next` values from becoming return targets.
- [ ] Retain the nav link to `/auth`, but rename it from "Auth" to **"Session"** (description: session state and sign-out) and group it separately at the bottom of `dashboardNavItems` so it reads as session management, not a dashboard feature page. It links to public `/auth` (allowlisted, so no redirect loop). Removing it is rejected because the app has no other sign-out entry point.

### Task 5: Protect Dashboard APIs Without Breaking Public Auth

**Files:**
- Middleware from Task 2
- Existing API route tests under `lore-web/src/app/api/**`
- E2E tests under `lore-web/tests/e2e/`

- [ ] Verify unauthenticated requests to `/api/capabilities`, `/api/repositories`, nested `/api/repositories/**`, and `/api/settings` return `401`.
- [ ] Verify unauthenticated requests to `/api/auth/session`, `/api/auth/signin`, and `/api/browser-session` remain public.
- [ ] Verify authorized `none`, `bearer`, and `oidc` sessions can still call dashboard APIs.
- [ ] Ensure route handlers do not need duplicated guard code unless middleware is bypassed by a test harness. If a test harness bypasses middleware, add helper-level tests for the guard and keep route tests focused on route behavior.

### Task 6: Verification Matrix

**Files:**
- Modify: `lore-web/tests/e2e/auth.spec.ts`
- Modify: `lore-web/tests/e2e/dashboard-shell.spec.ts`
- Modify: `lore-web/tests/e2e/live-auth-matrix.spec.ts`
- Add focused unit tests as described above

- [ ] Unit test auth-gate helpers.
- [ ] Unit/route test the browser-session endpoint.
- [ ] Playwright: visiting `/` while unauthenticated lands on `/auth`.
- [ ] Playwright: visiting `/` while authenticated lands on `/overview` (not `/auth`) — guards against the page redirecting authenticated users back to login.
- [ ] Playwright: direct `/overview`, `/repositories`, and `/settings` visits redirect to `/auth?next=...` when unauthorized.
- [ ] Playwright: no-auth continue creates the local session and reaches the dashboard.
- [ ] Playwright: bearer mode requires saving a bearer token before reaching the dashboard.
- [ ] Playwright: OIDC mode requires NextAuth sign-in and an access token before reaching the dashboard.
- [ ] Playwright: sign-out returns to `/auth` and protected routes are blocked again.
- [ ] Playwright/API: unauthenticated dashboard API calls return `401`; public auth APIs remain reachable.
- [ ] Live auth matrix: keep no-auth, bearer, and OIDC workflows passing after the gate.
- [ ] Final commands:

```bash
cd lore-web
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

- [ ] If `D:\depot\lore\target\debug\loreserver.exe` is available, run the live matrix below. (Verified: `live-auth-matrix.spec.ts` self-manages the harness — it reads `LORE_SERVER_BIN` via `resolveLoreServerBinary()` to spawn the Lore server *and* spawns its own Next dev server on dynamically reserved ports with a per-context `baseURL`, so no separate `npm run dev` is needed and `playwright.live.config.ts` intentionally has no `webServer` block.)

```powershell
cd lore-web
$env:LORE_SERVER_BIN="D:\depot\lore\target\debug\loreserver.exe"; npx playwright test --config playwright.live.config.ts --reporter=line
```

## Review Checklist For This Design

- [ ] The public `/auth` page has enough public API surface to log in without exposing dashboard APIs.
- [ ] `authMode=none` still requires an explicit browser action before dashboard access.
- [ ] `authMode=bearer` authorization is tied to a saved HTTP-only token, not merely to selecting bearer mode.
- [ ] `authMode=oidc` checks for an actual access token, not only a user profile.
- [ ] Sign-out behavior is mode-aware and returns to `/auth`.
- [ ] Middleware protection covers both dashboard pages and dashboard APIs.
- [ ] Safe `next` handling prevents open redirects, auth loops, and API redirects.
- [ ] Classification is default-deny: an unlisted route is protected, not public.
- [ ] Middleware never calls `getToken` without a configured secret, and `getToken` failures degrade to "no token" rather than erroring.
- [ ] `safeAuthNextPath`, auth-mode precedence, and cookie writing each exist in exactly one shared implementation (no forked copies).
- [ ] The `none`-mode gate is documented as UX/flow consistency, not an authentication boundary.
- [ ] State-changing session POSTs have a defined CSRF posture (SameSite=Lax or an explicit origin check).
- [ ] `/` sends unauthenticated users to `/auth` (via the gate) and authenticated users to `/overview` (via `page.tsx`), with no `/auth ↔ /` bounce.
