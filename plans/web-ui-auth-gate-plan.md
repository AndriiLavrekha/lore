# Lore Web Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate Lore Web so `/auth` is the public entry page and every dashboard page/API requires an authorized browser session.

**Architecture:** Use a small middleware gate for page/API admission and a server-side auth helper that defines mode-specific session readiness. Move `/auth` out of the dashboard route group, keep NextAuth under `/api/auth/*`, and add a narrow public browser-session endpoint for local no-auth login, bearer-token login, and local sign-out. Dashboard pages and dashboard APIs stay unchanged except for being protected before they execute.

**Tech Stack:** Next.js App Router, Next.js middleware, React 19, TypeScript, NextAuth v4 JWT sessions, zod, Vitest, Playwright.

---

## Non-Goals

- Do not change Lore server authentication or authorization.
- Do not add user accounts for `authMode=none`.
- Do not store bearer tokens in client-readable storage.
- Do not make implementation code changes on the design-only review branch.

## Required Behavior

- `/` redirects to `/auth`.
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

## Route And Session Model

| Surface | Access | Notes |
| --- | --- | --- |
| `/` | Public redirect | Redirects to `/auth`, not `/overview`. |
| `/auth` | Public | Reads current settings/session state server-side and provides login/sign-out actions. |
| `/api/auth/*` | Public | Existing NextAuth routes. |
| `/api/browser-session` | Public | New narrow endpoint for no-auth local session, bearer save/clear, and local sign-out. |
| `/overview`, `/repositories/**`, `/settings` | Protected | Middleware redirects unauthorized browsers to `/auth`. |
| `/api/capabilities`, `/api/repositories/**`, `/api/settings` | Protected | Middleware returns `401` JSON for unauthorized browsers. |

Use these cookies:

- Existing `lore_web_auth_mode` continues to select `none`, `bearer`, or `oidc` for the browser session.
- Existing `lore_web_bearer_token` remains HTTP-only and is sufficient authorization only when the selected auth mode is `bearer`.
- New `lore_web_local_auth` is HTTP-only, `SameSite=Lax`, `path=/`, `secure` in production, and session-only. It is sufficient authorization only when the selected auth mode is `none`.
- Existing NextAuth session cookies are sufficient authorization only when the selected auth mode is `oidc` and the JWT contains `accessToken`.

## Files To Touch During Implementation

- Modify `lore-web/src/app/page.tsx`: redirect `/` to `/auth`.
- Move/modify `lore-web/src/app/(dashboard)/auth/page.tsx` to `lore-web/src/app/auth/page.tsx`: make `/auth` a public route outside `AppShell`.
- Modify `lore-web/src/components/auth/auth-client.tsx`: add no-auth continue, bearer login, and mode-aware sign-out flows against the local browser-session endpoint.
- Create `lore-web/src/server/auth-gate.ts`: pure helper for cookie names, safe `next` paths, protected-route classification, and mode-specific authorization checks.
- Create `lore-web/src/middleware.ts`: enforce the auth gate for dashboard pages and dashboard APIs.
- Create `lore-web/src/app/api/browser-session/route.ts`: public endpoint for local session creation, bearer save/clear, and local sign-out.
- Modify `lore-web/src/lib/navigation.ts`: decide whether the dashboard nav should keep an Auth link to the public `/auth` page after sign-in.
- Add/update unit tests under `lore-web/src/server/*.test.ts` and route tests under `lore-web/src/app/api/**/*.test.ts`.
- Add/update Playwright tests under `lore-web/tests/e2e/`.

## Implementation Tasks

### Task 1: Add Pure Auth Gate Rules

**Files:**
- Create: `lore-web/src/server/auth-gate.ts`
- Create: `lore-web/src/server/auth-gate.test.ts`

- [ ] Define `LOCAL_AUTH_COOKIE_NAME = "lore_web_local_auth"`.
- [ ] Define `safeAuthNextPath(value)` with the same safety rules as `safeAuthNextPath` in `auth-page.ts`: local paths only, no protocol-relative URLs, no `/auth` loop, and no `/api` targets.
- [ ] Define `isProtectedPagePath(pathname)` for `/overview`, `/repositories`, nested repository paths, and `/settings`.
- [ ] Define `isProtectedApiPath(pathname)` for `/api/capabilities`, `/api/repositories`, nested repository APIs, and `/api/settings`.
- [ ] Define `resolveAuthMode(cookies, env)` so the browser cookie overrides `LORE_WEB_AUTH_MODE`, matching current session settings behavior.
- [ ] Define `hasAuthorizedBrowserSession({ authMode, hasLocalAuthCookie, hasBearerToken, hasOidcAccessToken })`:
  - `none`: true only with `lore_web_local_auth`.
  - `bearer`: true only with `lore_web_bearer_token`.
  - `oidc`: true only with a NextAuth JWT access token.
- [ ] Unit test route classification, safe `next` rejection, cookie/env auth-mode precedence, and all three authorization modes.

### Task 2: Add Middleware Gate

**Files:**
- Create: `lore-web/src/middleware.ts`
- Modify: `lore-web/src/server/auth-gate.ts`
- Modify: `lore-web/src/server/auth-gate.test.ts`

- [ ] Use `NextRequest` cookies plus `getToken` from `next-auth/jwt` to detect an OIDC JWT access token in middleware.
- [ ] Exclude static assets, `/_next/*`, `/favicon.ico`, `/auth`, `/api/auth/*`, and `/api/browser-session`.
- [ ] For unauthorized protected pages, redirect to `/auth?next=<encoded-safe-path>`.
- [ ] For unauthorized protected APIs, return `NextResponse.json({ error: "Authentication required" }, { status: 401 })`.
- [ ] Preserve the original request for authorized browsers.
- [ ] Add tests for page redirects, API 401 responses, public route pass-through, bearer cookie authorization, local no-auth cookie authorization, and OIDC JWT authorization.

### Task 3: Add Public Browser Session Endpoint

**Files:**
- Create: `lore-web/src/app/api/browser-session/route.ts`
- Modify: `lore-web/src/server/settings.ts` if shared schema constants are useful
- Add: `lore-web/src/app/api/browser-session/route.test.ts`

- [ ] Add a zod request schema with explicit actions: `start-none-session`, `save-bearer`, `clear-bearer`, and `sign-out-local`.
- [ ] `start-none-session` sets `lore_web_auth_mode=none` and `lore_web_local_auth=1` as HTTP-only session cookies.
- [ ] `save-bearer` validates a non-empty bearer token, sets `lore_web_auth_mode=bearer`, stores `lore_web_bearer_token` as HTTP-only, and deletes `lore_web_local_auth`.
- [ ] `clear-bearer` deletes `lore_web_bearer_token`.
- [ ] `sign-out-local` deletes `lore_web_local_auth` and `lore_web_bearer_token`; it does not attempt to clear NextAuth cookies.
- [ ] Return the same settings response shape that `/auth` already consumes, without returning token values.
- [ ] Test all cookie set/delete behavior and invalid request handling.

### Task 4: Make `/auth` Public And `/` Redirect To It

**Files:**
- Modify: `lore-web/src/app/page.tsx`
- Move/modify: `lore-web/src/app/(dashboard)/auth/page.tsx` to `lore-web/src/app/auth/page.tsx`
- Modify: `lore-web/src/components/auth/auth-client.tsx`
- Modify: `lore-web/src/lib/navigation.ts`

- [ ] Change `lore-web/src/app/page.tsx` to `redirect("/auth")`.
- [ ] Move `/auth` out of `(dashboard)` so it no longer inherits `AppShell`.
- [ ] Keep server-side reads of `readSessionSettingsResponse()`, `getServerSession(authOptions)`, `buildAuthPageState()`, and `safeAuthNextPath()`.
- [ ] Add a primary `Continue` action for `authMode=none` that posts `start-none-session`, then routes to `nextPath ?? "/overview"`.
- [ ] In `authMode=bearer`, make saving a bearer token the login action; after success, route to `nextPath ?? "/overview"`.
- [ ] In `authMode=oidc`, call `signIn("oidc", { callbackUrl: nextPath ?? "/overview" })`.
- [ ] Make sign-out mode-aware:
  - `none`: post `sign-out-local`, then route to `/auth`.
  - `bearer`: post `sign-out-local`, then route to `/auth`.
  - `oidc`: call `signOut({ callbackUrl: "/auth" })`.
- [ ] Keep `/auth?next=/auth`, `/auth?next=/api/settings`, and external `next` values from becoming return targets.
- [ ] Decide during implementation review whether dashboard navigation should retain an Auth link. If retained, it should link to public `/auth` and clearly behave as session management/sign-out, not as a dashboard-only page.

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
- [ ] Playwright: visiting `/` lands on `/auth`.
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

- [ ] If `D:\depot\lore\target\debug\loreserver.exe` is available, run:

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
