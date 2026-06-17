# Lore Web

Lore Web is a Next.js App Router management dashboard for a running Lore server.
The browser talks to a Next.js BFF; gRPC, proto loading, bearer tokens, Auth.js
OIDC token lookup, and storage metadata helpers are intentionally server-only.

## Runtime

- Node.js: `v24.14.0`
- npm: `11.7.0`

## Local Setup

```powershell
npm install
npm run dev -- --port 3000
```

Open `http://127.0.0.1:3000/overview`.

## Scripts

- `npm run dev`: start the local Next.js development server.
- `npm run build`: create a production build.
- `npm run lint`: run ESLint.
- `npm run typecheck`: run `tsc --noEmit`.
- `npm test`: run Vitest unit tests.
- `npm run test:e2e`: run Playwright smoke tests.

## Environment

Copy `.env.example` to `.env.local` when local overrides are needed.

| Variable | Default | Notes |
| --- | --- | --- |
| `LORE_WEB_GRPC_TARGET` | `127.0.0.1:41337` | Lore gRPC target. |
| `LORE_WEB_HTTP_BASE` | `http://127.0.0.1:41339` | Lore HTTP health endpoint base. |
| `LORE_WEB_GRPC_TLS` | `insecure` | Use `tls` only when the server is configured for gRPC TLS. |
| `LORE_WEB_GRPC_CA` | empty | Optional PEM path for TLS CA. |
| `LORE_WEB_AUTH_MODE` | `none` | Planned values: `none`, `bearer`, `oidc`. |
| `LORE_WEB_NOTIFICATION_STREAM` | empty | Required before Activity SSE is enabled. |
| `AUTH_SECRET` | empty | Required before OIDC is enabled; `NEXTAUTH_SECRET` is also accepted. |
| `AUTH_URL` | `http://127.0.0.1:3000` | Auth.js base URL for OIDC mode; mirror to `NEXTAUTH_URL` for NextAuth v4 tooling. |
| `NEXTAUTH_SECRET` | empty | Compatibility alias for Auth.js/NextAuth v4. |
| `NEXTAUTH_URL` | `http://127.0.0.1:3000` | Compatibility alias for Auth.js/NextAuth v4. |
| `AUTH_OIDC_ISSUER` | empty | OIDC issuer. |
| `AUTH_OIDC_CLIENT_ID` | empty | OIDC client id. |
| `AUTH_OIDC_CLIENT_SECRET` | empty | OIDC client secret. |

## Auth

`LORE_WEB_AUTH_MODE=none` sends no authorization metadata. `bearer` reads the
httpOnly `lore_web_bearer_token` cookie managed by `/api/settings`. `oidc` uses
Auth.js at `/api/auth/*` and forwards the provider access token from the
server-side JWT to gRPC authorization metadata. The access token is not exposed
in Settings or session JSON; Settings reports only whether OIDC is configured
and whether a token-forwarding path is active.

## Troubleshooting

- gRPC target: confirm `LORE_WEB_GRPC_TARGET` points at the Lore gRPC port, not
  the HTTP health port. Local default is `127.0.0.1:41337`.
- HTTP target: `/api/capabilities` uses `LORE_WEB_HTTP_BASE` for
  `/health_check`. Local default is `http://127.0.0.1:41339`.
- TLS: keep `LORE_WEB_GRPC_TLS=insecure` for local plaintext servers. Use `tls`
  only with a TLS-enabled server and set `LORE_WEB_GRPC_CA` when a custom CA is
  required.
- Bearer auth: if capabilities report `missing-token`, set the bearer token
  through `/api/settings` or Settings UI before retrying repository-scoped
  actions.
- OIDC auth: Settings must show no missing OIDC values, and the provider must
  allow the callback URL shown there.
- Locks: Lock pages are degraded when `LockService` is unavailable or returns
  `UNIMPLEMENTED`; repository metadata must still be present for repo-scoped
  lock requests.
- Notifications: Activity SSE is disabled until `LORE_WEB_NOTIFICATION_STREAM`
  is set and the server has a reachable notification service.

## v1 Limitations

- Server-backed workflow verification requires a running Lore server and CLI;
  local Playwright tests cover reachable controls and degraded states.
- Branch protection uses a narrow metadata CAS path in the BFF and must be
  verified against real Lore metadata serialization before production rollout.
- Auth.js OIDC forwards provider access tokens; deployments that need token
  exchange or resource-specific token minting should add that policy server-side.
- Activity timeline state is page-local and does not persist across reloads.

## v1.1 Follow-ups

- Add CI and Docker packaging after maintainers choose the deployment target.
- Replace dynamic proto loading with generated TypeScript if runtime shape bugs
  outgrow the current test coverage.
- Add docs-site integration and a Lore Enhancement Proposal for any public API
  or wire-format changes discovered during server-backed validation.
