# Lore Web Auth Page Design

## Summary

Add a dedicated Lore Web `/auth` route as a hybrid authentication surface. The route acts as a production entry point when authentication is required and as an operator-facing authentication hub after the user is inside the dashboard.

The page must feel like a premium operational dashboard, not a rough wireframe or marketing landing page. It should use the existing Lore Web shell, design tokens, source UI primitives, and server-only auth helpers. It must not introduce client-side access to gRPC/proto/token plumbing beyond the existing HTTP-only cookie and NextAuth boundaries.

## Goals

- Give production deployments a clear authentication page without hiding auth inside Settings.
- Support three auth modes: `none`, `bearer`, and `oidc`.
- Show OIDC readiness, callback URL, missing server configuration, and token-forwarding state.
- Let operators save and clear a bearer token for the current browser session.
- Provide sign-in and sign-out actions for configured OIDC deployments.
- Preserve the existing Settings page as the broader connection configuration surface.
- Keep the final UI polished, responsive, accessible, and consistent with the current dashboard.

## Non-Goals

- Do not add custom user management, password login, invitations, roles, or authorization policy editing.
- Do not create a second auth configuration store.
- Do not expose bearer tokens or OIDC access tokens back to client-rendered markup.
- Do not add `lore-web/` to the Rust Cargo workspace.
- Do not move gRPC, proto loading, or token forwarding into client components.

## Route Behavior

`/auth` is a dashboard route and appears in desktop and mobile navigation. It can be opened directly by an operator or used as a future gate target when a protected dashboard route needs authentication.

The first version does not need full middleware enforcement across every route. It should prepare the page for gate behavior by accepting an optional return path query parameter, for example `/auth?next=/repositories`. After a successful sign-in or token save, the UI should offer a clear route back to the requested page when that path is local and safe. Unsafe or external return paths are ignored.

For `LORE_WEB_AUTH_MODE=none`, `/auth` remains available and clearly states that authentication is disabled for this server/session. It should still show the active target and related settings status.

For `LORE_WEB_AUTH_MODE=bearer`, the bearer panel is primary. The OIDC panel becomes secondary diagnostic information.

For `LORE_WEB_AUTH_MODE=oidc`, the OIDC panel is primary. If OIDC is not fully configured, the page shows missing environment variables and the expected callback URL instead of presenting a broken login action as the main call to action.

## Page Composition

The page uses the existing `AppShell` layout and adds an Auth navigation item with a suitable lucide icon. The UI should be compact and operational:

- Page header: current auth mode, current target, and a primary action aligned with the active mode.
- Session summary: signed-in state, token-forwarding state, stored bearer-token state, and connection target.
- OIDC panel: sign-in, sign-out, callback URL, configured/missing state, and token-forwarding diagnostics.
- Bearer panel: masked token input, save token, clear token, and status message.
- Auth mode panel: show the session's current mode and link to Settings for broader connection changes.
- Gate return action: when a valid `next` path is present, provide a post-auth "Continue" action to that path.

The final visual treatment should be more polished than the brainstorming mockup: restrained color, clear hierarchy, consistent radii, strong focus states, icon-bearing buttons, no nested cards, no decorative clutter, and responsive layouts that remain readable on mobile.

## Data And Security Boundaries

Server components may call existing server-only helpers such as `getServerConfig()` and `getOidcRuntimeStatus()`.

Client components may use:

- NextAuth client actions for OIDC sign-in/sign-out.
- `/api/settings` for saving or clearing bearer-token session cookies.
- Rendered status values that are safe to disclose, such as whether a bearer token exists.

Client components must not receive raw OIDC access tokens, raw bearer tokens after save, gRPC clients, proto descriptors, or server secrets. Bearer tokens are written once through the form and then cleared from component state after a successful save.

The existing settings API currently supports saving a bearer token. The auth page also needs a clear-token flow. This can be implemented by extending the settings API with explicit clearing semantics or by adding a narrowly scoped auth-session API route. The implementation should choose the smaller option that preserves existing Settings behavior and is easy to test.

## Error Handling

The page should show actionable messages for:

- Missing OIDC environment variables.
- OIDC sign-in unavailable because the provider is not configured.
- Settings save or clear failures.
- Invalid return paths.
- Authentication disabled mode.

Status changes should be announced through an `aria-live` region. Failed requests should preserve user input only when doing so is useful and safe; saved bearer-token inputs should be cleared on success.

## Accessibility And UX Requirements

- Use a single `h1` and logical section headings.
- All inputs and buttons must have accessible names.
- Keyboard navigation must cover sign-in, sign-out, token input, save, clear, Settings link, and continue action.
- Focus states must be visible and consistent with existing dashboard controls.
- The mobile layout must avoid horizontal overflow except for intentional data tables, which this page should not need.
- Buttons must be functional, not decorative placeholders.
- Loading and disabled states must avoid layout shift.

## Testing Plan

Unit and component-level tests should cover:

- Auth status derivation for `none`, `bearer`, configured OIDC, and missing OIDC config.
- Safe handling of `next` return paths.
- Bearer-token save and clear request behavior.
- No raw saved token rendered after a successful save.

Playwright tests should cover:

- `/auth` renders in no-auth mode and shows authentication disabled state.
- Bearer mode can enter a token, save it, clear it, and see status changes.
- OIDC configured state shows sign-in and callback diagnostics.
- OIDC missing-config state shows missing variables and does not present a misleading ready login action.
- Navigation exposes Auth in desktop and mobile layouts.

Live auth-matrix tests should remain the project-level end-to-end proof for token forwarding against real Lore server modes. If the auth page introduces live-flow changes, update the matrix rather than creating a separate divergent harness.

## Acceptance Criteria

- `/auth` exists and is reachable from dashboard navigation.
- The page supports `none`, `bearer`, and `oidc` modes with mode-appropriate primary actions.
- OIDC secrets and bearer tokens remain server-only or write-only as appropriate.
- The final page is visually polished and consistent with the current dashboard.
- Auth UI controls are clickable and covered by tests.
- `npm run lint`, `npm run typecheck`, `npm test`, relevant Playwright tests, `npm run build`, and Cargo workspace isolation checks pass before merge.
