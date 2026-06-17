# Lore Web

Lore Web is a Next.js App Router management dashboard for a running Lore server.
Phase 0 contains only the project shell, static navigation, placeholder pages, and
local tooling. gRPC, proto loading, auth tokens, and storage metadata code are
intentionally deferred to later phases and must remain server-only.

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
| `AUTH_SECRET` | empty | Required before OIDC is enabled. |
| `AUTH_URL` | `http://127.0.0.1:3000` | Auth.js base URL for OIDC mode. |
| `AUTH_OIDC_ISSUER` | empty | OIDC issuer for later phases. |
| `AUTH_OIDC_CLIENT_ID` | empty | OIDC client id for later phases. |
| `AUTH_OIDC_CLIENT_SECRET` | empty | OIDC client secret for later phases. |

## Phase 0 Scope

- Static app shell with Overview, Repositories, Settings, and repository-scoped
  placeholder pages.
- No dependency on a running `loreserver`.
- No changes to the Rust Cargo workspace.
- No gRPC, proto, or token-bearing browser imports.
