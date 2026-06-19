# Lore Web Auth Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished hybrid `/auth` route for Lore Web that supports OIDC sign-in/sign-out, bearer token save/clear, no-auth diagnostics, and safe return navigation.

**Architecture:** Keep `/auth` inside the existing App Router dashboard shell. Server components read safe auth/config/session status; a focused client component handles button clicks, bearer-token form state, and calls `/api/settings`. Token and OIDC internals stay server-only.

**Tech Stack:** Next.js App Router, React 19, TypeScript, NextAuth v4, zod, Tailwind CSS, lucide-react, Vitest, Playwright.

---

## File Structure

- Modify `lore-web/src/server/settings.ts`: add an explicit `clearBearerToken` request field.
- Create `lore-web/src/server/session-settings.ts`: shared server-only reader for env defaults plus browser session cookies.
- Modify `lore-web/src/app/api/settings/route.ts`: delete the bearer-token cookie when `clearBearerToken` is true.
- Modify `lore-web/src/app/(dashboard)/settings/page.tsx`: use the shared reader so Settings reflects session cookies on first render.
- Create `lore-web/src/server/auth-page.ts`: pure helpers for safe `next` paths and auth-page display state.
- Create `lore-web/src/server/auth-page.test.ts`: unit coverage for safe return paths and display state.
- Create `lore-web/src/app/(dashboard)/auth/page.tsx`: server route that reads config, OIDC runtime status, safe `next`, and current NextAuth session.
- Create `lore-web/src/components/auth/auth-client.tsx`: polished interactive auth page UI.
- Modify `lore-web/src/lib/navigation.ts`: add the Auth nav item.
- Modify `lore-web/tests/e2e/dashboard-shell.spec.ts`: assert Auth appears in dashboard navigation.
- Create `lore-web/tests/e2e/auth.spec.ts`: mocked Playwright coverage for no-auth, bearer save/clear, OIDC configured, and OIDC missing-config states.

---

### Task 1: Session Settings And Bearer Clear Semantics

**Files:**
- Modify: `lore-web/src/server/settings.ts`
- Create: `lore-web/src/server/session-settings.ts`
- Modify: `lore-web/src/app/api/settings/route.ts`
- Modify: `lore-web/src/app/(dashboard)/settings/page.tsx`
- Modify: `lore-web/src/server/settings.test.ts`

- [ ] **Step 1: Write the failing schema test**

Append this test inside the existing `describe("settings schemas", ...)` block in `lore-web/src/server/settings.test.ts`:

```ts
  it("accepts explicit bearer token clearing without requiring a token value", () => {
    const request = settingsRequestSchema.parse({
      clearBearerToken: true,
    });

    expect(request.clearBearerToken).toBe(true);
    expect(request.bearerToken).toBeUndefined();
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd lore-web
npm test -- src/server/settings.test.ts
```

Expected: FAIL because `clearBearerToken` is not present in the parsed request.

- [ ] **Step 3: Add the request field**

In `lore-web/src/server/settings.ts`, update `settingsRequestSchema` to:

```ts
export const settingsRequestSchema = z.object({
  grpcTarget: z.string().min(1).optional(),
  httpBase: z.string().url().optional(),
  grpcTls: z.enum(["insecure", "tls"]).optional(),
  grpcCa: z.string().min(1).optional(),
  authMode: z.enum(["none", "bearer", "oidc"]).optional(),
  notificationStream: z.string().min(1).optional(),
  bearerToken: z.string().min(1).optional(),
  clearBearerToken: z.boolean().optional(),
});
```

- [ ] **Step 4: Add a shared server-only session settings reader**

Create `lore-web/src/server/session-settings.ts`:

```ts
import "server-only";

import { cookies } from "next/headers";

import { getOidcRuntimeStatus } from "@/server/auth";
import { getServerConfig } from "@/server/config";
import { SETTINGS_COOKIE_NAMES, settingsResponseSchema } from "@/server/settings";

export async function readSessionSettingsResponse() {
  const cookieStore = await cookies();
  const hasBearerToken = Boolean(cookieStore.get(SETTINGS_COOKIE_NAMES.bearerToken)?.value);
  const config = getServerConfig({
    ...process.env,
    LORE_WEB_GRPC_TARGET:
      cookieStore.get(SETTINGS_COOKIE_NAMES.grpcTarget)?.value ??
      process.env.LORE_WEB_GRPC_TARGET,
    LORE_WEB_HTTP_BASE:
      cookieStore.get(SETTINGS_COOKIE_NAMES.httpBase)?.value ?? process.env.LORE_WEB_HTTP_BASE,
    LORE_WEB_GRPC_TLS:
      cookieStore.get(SETTINGS_COOKIE_NAMES.grpcTls)?.value ?? process.env.LORE_WEB_GRPC_TLS,
    LORE_WEB_GRPC_CA:
      cookieStore.get(SETTINGS_COOKIE_NAMES.grpcCa)?.value ?? process.env.LORE_WEB_GRPC_CA,
    LORE_WEB_AUTH_MODE:
      cookieStore.get(SETTINGS_COOKIE_NAMES.authMode)?.value ?? process.env.LORE_WEB_AUTH_MODE,
    LORE_WEB_NOTIFICATION_STREAM:
      cookieStore.get(SETTINGS_COOKIE_NAMES.notificationStream)?.value ??
      process.env.LORE_WEB_NOTIFICATION_STREAM,
  });
  const oidc = getOidcRuntimeStatus();
  const tokenForwarding =
    config.authMode === "oidc"
      ? oidc.tokenForwarding
      : config.authMode === "bearer" && hasBearerToken
        ? "bearer-cookie"
        : "disabled";

  return settingsResponseSchema.parse({
    ...config,
    hasBearerToken,
    oidc: {
      ...oidc,
      tokenForwarding,
    },
  });
}
```

- [ ] **Step 5: Use the shared reader in the settings route**

In `lore-web/src/app/api/settings/route.ts`, remove the local `readSettingsResponse()` function and its now-unused imports. Import the shared reader instead:

```ts
import { readSessionSettingsResponse } from "@/server/session-settings";
```

Update `GET`:

```ts
export async function GET() {
  return NextResponse.json(await readSessionSettingsResponse());
}
```

Update the end of `POST` so bearer-token deletion happens after normal cookie writes and before reading the response:

```ts
  if (body.clearBearerToken) {
    cookieStore.delete(SETTINGS_COOKIE_NAMES.bearerToken);
  }

  return NextResponse.json(await readSessionSettingsResponse());
```

Keep the existing loop behavior unchanged so Settings can still update connection fields without clearing a stored token.

- [ ] **Step 6: Use the shared reader in Settings first render**

In `lore-web/src/app/(dashboard)/settings/page.tsx`, replace direct config/OIDC construction with:

```tsx
import { PageHeader } from "@/components/page-header";
import { SettingsClient } from "@/components/settings/settings-client";
import { readSessionSettingsResponse } from "@/server/session-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await readSessionSettingsResponse();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Connection defaults and session override fields for the Lore dashboard BFF."
        label="Session scoped"
      />

      <SettingsClient initialSettings={settings} />
    </>
  );
}
```

- [ ] **Step 7: Verify focused tests pass**

Run:

```bash
cd lore-web
npm test -- src/server/settings.test.ts
```

Expected: PASS.

- [ ] **Step 8: Verify typecheck after server-only import**

Run:

```bash
cd lore-web
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add lore-web/src/server/settings.ts lore-web/src/server/session-settings.ts lore-web/src/app/api/settings/route.ts lore-web/src/app/(dashboard)/settings/page.tsx lore-web/src/server/settings.test.ts
git commit -s -m "feat: allow clearing lore web bearer token"
```

---

### Task 2: Auth Page Server Helpers

**Files:**
- Create: `lore-web/src/server/auth-page.ts`
- Create: `lore-web/src/server/auth-page.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `lore-web/src/server/auth-page.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildAuthPageState, safeAuthNextPath } from "@/server/auth-page";
import type { SettingsResponse } from "@/server/settings";

const baseSettings: SettingsResponse = {
  grpcTarget: "127.0.0.1:41337",
  httpBase: "http://127.0.0.1:41339",
  grpcTls: "insecure",
  authMode: "none",
  hasBearerToken: false,
  oidc: {
    enabled: false,
    missing: ["AUTH_SECRET"],
    callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
    tokenForwarding: "disabled",
  },
};

describe("safeAuthNextPath", () => {
  it("accepts local dashboard paths", () => {
    expect(safeAuthNextPath("/repositories")).toBe("/repositories");
    expect(safeAuthNextPath("/repositories?id=123")).toBe("/repositories?id=123");
  });

  it("rejects unsafe or auth-loop paths", () => {
    expect(safeAuthNextPath("https://example.test/repositories")).toBeUndefined();
    expect(safeAuthNextPath("//example.test/repositories")).toBeUndefined();
    expect(safeAuthNextPath("/api/settings")).toBeUndefined();
    expect(safeAuthNextPath("/auth?next=/repositories")).toBeUndefined();
    expect(safeAuthNextPath(undefined)).toBeUndefined();
  });
});

describe("buildAuthPageState", () => {
  it("uses no-auth state when auth mode is none", () => {
    expect(buildAuthPageState(baseSettings, undefined).primaryMode).toBe("none");
  });

  it("prioritizes bearer when auth mode is bearer", () => {
    expect(buildAuthPageState({ ...baseSettings, authMode: "bearer" }, "/repositories")).toMatchObject({
      primaryMode: "bearer",
      nextPath: "/repositories",
    });
  });

  it("marks oidc configured as ready", () => {
    expect(
      buildAuthPageState({
        ...baseSettings,
        authMode: "oidc",
        oidc: {
          enabled: true,
          missing: [],
          callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
          tokenForwarding: "oidc-access-token",
        },
      }, undefined),
    ).toMatchObject({
      primaryMode: "oidc",
      oidcReady: true,
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd lore-web
npm test -- src/server/auth-page.test.ts
```

Expected: FAIL because `@/server/auth-page` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `lore-web/src/server/auth-page.ts`:

```ts
import type { SettingsResponse } from "@/server/settings";

export type AuthPagePrimaryMode = SettingsResponse["authMode"];

export type AuthPageState = {
  primaryMode: AuthPagePrimaryMode;
  nextPath?: string;
  oidcReady: boolean;
  bearerReady: boolean;
  disabled: boolean;
};

export function safeAuthNextPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate, "http://lore-web.local");
  } catch {
    return undefined;
  }

  if (parsed.origin !== "http://lore-web.local") {
    return undefined;
  }

  if (parsed.pathname === "/auth" || parsed.pathname.startsWith("/api/")) {
    return undefined;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildAuthPageState(settings: SettingsResponse, nextPath?: string): AuthPageState {
  return {
    primaryMode: settings.authMode,
    nextPath,
    oidcReady: settings.authMode === "oidc" && settings.oidc.enabled,
    bearerReady: settings.authMode === "bearer" && settings.hasBearerToken,
    disabled: settings.authMode === "none",
  };
}
```

- [ ] **Step 4: Verify focused tests pass**

Run:

```bash
cd lore-web
npm test -- src/server/auth-page.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lore-web/src/server/auth-page.ts lore-web/src/server/auth-page.test.ts
git commit -s -m "feat: add lore web auth page state helpers"
```

---

### Task 3: Auth Route And Polished Client UI

**Files:**
- Create: `lore-web/src/app/(dashboard)/auth/page.tsx`
- Create: `lore-web/src/components/auth/auth-client.tsx`
- Modify: `lore-web/src/lib/navigation.ts`

- [ ] **Step 1: Add Auth to navigation**

In `lore-web/src/lib/navigation.ts`, import `ShieldCheck` from `lucide-react` and insert this nav item before Settings:

```ts
  {
    href: "/auth",
    label: "Auth",
    description: "Sign-in state, bearer token, and OIDC diagnostics.",
    icon: ShieldCheck,
  },
```

- [ ] **Step 2: Create the server route**

Create `lore-web/src/app/(dashboard)/auth/page.tsx`:

```tsx
import { getServerSession } from "next-auth";

import { AuthClient } from "@/components/auth/auth-client";
import { authOptions } from "@/server/auth";
import { buildAuthPageState, safeAuthNextPath } from "@/server/auth-page";
import { readSessionSettingsResponse } from "@/server/session-settings";

type AuthPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const settings = await readSessionSettingsResponse();
  const session = await getServerSession(authOptions);
  const sessionWithToken = session as typeof session & { hasAccessToken?: boolean };
  const nextPath = safeAuthNextPath(params.next);

  return (
    <AuthClient
      initialSettings={settings}
      state={buildAuthPageState(settings, nextPath)}
      oidcSession={{
        authenticated: Boolean(session?.user),
        name: session?.user?.name ?? undefined,
        email: session?.user?.email ?? undefined,
        hasAccessToken: Boolean(sessionWithToken?.hasAccessToken),
      }}
    />
  );
}
```

- [ ] **Step 3: Create the client component**

Create `lore-web/src/components/auth/auth-client.tsx` with a focused client implementation:

```tsx
"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { CheckCircle2, KeyRound, Loader2, LogIn, LogOut, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuthPageState } from "@/server/auth-page";
import type { SettingsResponse } from "@/server/settings";

type OidcSessionState = {
  authenticated: boolean;
  name?: string;
  email?: string;
  hasAccessToken: boolean;
};

type RequestState = { tone: "idle" | "success" | "error"; message: string };

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }

  return payload;
}

export function AuthClient({
  initialSettings,
  state,
  oidcSession,
}: {
  initialSettings: SettingsResponse;
  state: AuthPageState;
  oidcSession: OidcSessionState;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [bearerToken, setBearerToken] = useState("");
  const [loading, setLoading] = useState<"save" | "clear" | null>(null);
  const [requestState, setRequestState] = useState<RequestState>({
    tone: "idle",
    message: "Authentication status loaded.",
  });

  const callbackUrl = state.nextPath ?? "/overview";
  const modeLabel = settings.authMode.toUpperCase();
  const statusTone = settings.authMode === "none" ? "secondary" : settings.authMode === "oidc" && settings.oidc.enabled ? "default" : "outline";
  const identityLabel = useMemo(() => {
    if (!oidcSession.authenticated) return "No OIDC session";
    return oidcSession.name ?? oidcSession.email ?? "OIDC session active";
  }, [oidcSession.authenticated, oidcSession.email, oidcSession.name]);

  async function saveBearerToken() {
    if (!bearerToken.trim()) {
      setRequestState({ tone: "error", message: "Enter a bearer token before saving." });
      return;
    }

    setLoading("save");
    try {
      const payload = await readJson<SettingsResponse>(
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bearerToken: bearerToken.trim(), authMode: "bearer" }),
        }),
      );
      setSettings(payload);
      setBearerToken("");
      setRequestState({ tone: "success", message: "Bearer token saved for this browser session." });
    } catch (error) {
      setRequestState({ tone: "error", message: error instanceof Error ? error.message : "Bearer token save failed." });
    } finally {
      setLoading(null);
    }
  }

  async function clearBearerToken() {
    setLoading("clear");
    try {
      const payload = await readJson<SettingsResponse>(
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clearBearerToken: true }),
        }),
      );
      setSettings(payload);
      setBearerToken("");
      setRequestState({ tone: "success", message: "Bearer token cleared for this browser session." });
    } catch (error) {
      setRequestState({ tone: "error", message: error instanceof Error ? error.message : "Bearer token clear failed." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="rounded-lg border bg-card/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusTone}>{modeLabel}</Badge>
              <Badge variant="outline">{settings.grpcTls}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-foreground">Authentication</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Manage the current browser session for Lore Web. Tokens stay server-side or write-only, and gRPC requests use the active auth mode.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.nextPath ? (
              <Button asChild>
                <Link href={state.nextPath}>
                  <CheckCircle2 aria-hidden="true" />
                  Continue
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/settings">
                <SlidersHorizontal aria-hidden="true" />
                Settings
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusTile label="Session" value={identityLabel} detail={oidcSession.hasAccessToken ? "OIDC access token available" : "No OIDC access token"} />
        <StatusTile label="Bearer token" value={settings.hasBearerToken ? "Stored" : "Not stored"} detail="HTTP-only session cookie" />
        <StatusTile label="Token forwarding" value={settings.authMode === "bearer" && settings.hasBearerToken ? "bearer-cookie" : settings.oidc.tokenForwarding} detail="Server-side gRPC metadata" />
        <StatusTile label="Target" value={settings.grpcTarget} detail={settings.httpBase} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border bg-card/95 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
                OIDC session
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Sign in with the configured identity provider. Lore Web forwards the OIDC access token from the server session when OIDC mode is active.
              </p>
            </div>
            <Badge variant={settings.oidc.enabled ? "default" : "outline"}>{settings.oidc.enabled ? "ready" : "not configured"}</Badge>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => signIn("oidc", { callbackUrl })}
              disabled={!settings.oidc.enabled}
            >
              <LogIn aria-hidden="true" />
              Sign in with OIDC
            </Button>
            <Button type="button" variant="outline" onClick={() => signOut({ callbackUrl: "/auth" })}>
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">Callback URL</dt>
            <dd className="min-w-0 truncate font-mono text-xs">{settings.oidc.callbackUrl}</dd>
            <dt className="text-muted-foreground">Missing config</dt>
            <dd>{settings.oidc.missing.length > 0 ? settings.oidc.missing.join(", ") : "none"}</dd>
            <dt className="text-muted-foreground">Forwarding</dt>
            <dd>{settings.oidc.tokenForwarding}</dd>
          </dl>
        </div>

        <div className="rounded-lg border bg-card/95 p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <KeyRound aria-hidden="true" className="size-5 text-primary" />
            Bearer fallback
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Save a bearer token for local testing or deployments that use token auth without an interactive identity provider.
          </p>

          <label className="mt-5 flex flex-col gap-2 text-sm font-medium">
            Bearer token
            <input
              aria-label="Bearer token"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              type="password"
              value={bearerToken}
              onChange={(event) => setBearerToken(event.target.value)}
              placeholder={settings.hasBearerToken ? "token already stored" : "paste token"}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={saveBearerToken} disabled={loading !== null}>
              {loading === "save" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <KeyRound aria-hidden="true" />}
              Save token
            </Button>
            <Button type="button" variant="outline" onClick={clearBearerToken} disabled={loading !== null || !settings.hasBearerToken}>
              {loading === "clear" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
              Clear
            </Button>
          </div>
        </div>
      </section>

      <div
        role="status"
        aria-live="polite"
        className={`rounded-md border px-3 py-2 text-sm ${
          requestState.tone === "error" ? "border-destructive/40 text-destructive" : "text-muted-foreground"
        }`}
      >
        {settings.authMode === "none"
          ? "Authentication is disabled for this Lore Web session."
          : requestState.message}
      </div>
    </div>
  );
}

function StatusTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card/95 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
```

- [ ] **Step 4: Resolve TypeScript issues without weakening boundaries**

If the `session.hasAccessToken` access fails, update `page.tsx` as described in Step 2 with `sessionWithToken`.

If `Badge` does not accept `"default"` as a variant in this codebase, replace that usage with `"secondary"` and keep the same status text.

- [ ] **Step 5: Run focused typecheck**

Run:

```bash
cd lore-web
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lore-web/src/app/(dashboard)/auth/page.tsx lore-web/src/components/auth/auth-client.tsx lore-web/src/lib/navigation.ts
git commit -s -m "feat: add lore web auth page"
```

---

### Task 4: Playwright Coverage For Auth UI

**Files:**
- Create: `lore-web/tests/e2e/auth.spec.ts`
- Modify: `lore-web/tests/e2e/dashboard-shell.spec.ts`

- [ ] **Step 1: Write the mocked auth-page tests**

Create `lore-web/tests/e2e/auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const cookieUrl = "http://127.0.0.1:3000";

test("auth page shows disabled state in no-auth mode", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Authentication" })).toBeVisible();
  await expect(page.getByText("Authentication is disabled for this Lore Web session.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with OIDC" })).toBeDisabled();
});

test("auth page saves and clears bearer token", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "lore_web_auth_mode",
      value: "bearer",
      url: cookieUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.route("**/api/settings", async (route) => {
    const request = route.request();
    const body = request.method() === "POST" ? JSON.parse(request.postData() ?? "{}") : {};
    const hasBearerToken = Boolean(body.bearerToken) && !body.clearBearerToken;

    await route.fulfill({
      json: {
        grpcTarget: "127.0.0.1:41337",
        httpBase: "http://127.0.0.1:41339",
        grpcTls: "insecure",
        authMode: "bearer",
        notificationStream: "lore.events",
        hasBearerToken,
        oidc: {
          enabled: false,
          missing: ["AUTH_SECRET"],
          callbackUrl: "http://127.0.0.1:3000/api/auth/callback/oidc",
          tokenForwarding: hasBearerToken ? "bearer-cookie" : "disabled",
        },
      },
    });
  });

  await page.goto("/auth");

  await page.getByLabel("Bearer token").fill("test-token");
  await page.getByRole("button", { name: "Save token" }).click();
  await expect(page.getByRole("status")).toContainText("Bearer token saved");
  await expect(page.getByText("Stored")).toBeVisible();
  await expect(page.getByLabel("Bearer token")).toHaveValue("");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("status")).toContainText("Bearer token cleared");
  await expect(page.getByText("Not stored")).toBeVisible();
});

test("auth page shows missing oidc configuration without a ready login action", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "lore_web_auth_mode",
      value: "oidc",
      url: cookieUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/auth?next=/repositories");

  await expect(page.getByText("not configured")).toBeVisible();
  await expect(page.getByText(/AUTH_SECRET/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with OIDC" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/repositories");
});
```

- [ ] **Step 2: Update shell navigation test**

In `lore-web/tests/e2e/dashboard-shell.spec.ts`, after the Repositories assertion, add:

```ts
  await expect(page.getByLabel("Dashboard", { exact: true }).getByRole("link", { name: "Auth" })).toBeVisible();
```

Then after navigating to Settings, add a click through Auth:

```ts
  await page.getByLabel("Dashboard", { exact: true }).getByRole("link", { name: "Auth" }).click();
  await expect(page.getByRole("heading", { name: "Authentication" })).toBeVisible();
```

- [ ] **Step 3: Run focused Playwright tests**

```bash
cd lore-web
npm run test:e2e -- auth dashboard-shell
```

Expected: PASS after Tasks 1-3. If a test fails, inspect the rendered page and adjust implementation or selectors without weakening the user-visible behavior.

- [ ] **Step 4: Add live OIDC auth-page coverage to the auth matrix**

In `lore-web/tests/e2e/live-auth-matrix.spec.ts`, inside the OIDC test after `await page.goto(`${baseUrl}/settings`);` and the three settings assertions, add:

```ts
        await page.goto(`${baseUrl}/auth?next=/repositories`);
        await expect(page.getByRole("heading", { name: "Authentication" })).toBeVisible();
        await expect(page.getByText("ready")).toBeVisible();
        await expect(page.getByText("oidc-access-token")).toBeVisible();
        await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/repositories");
```

- [ ] **Step 5: Verify focused Playwright tests pass again**

Run:

```bash
cd lore-web
npm run test:e2e -- auth dashboard-shell
```

Expected: PASS.

- [ ] **Step 6: Verify focused live auth matrix passes when local Lore binaries are available**

Run:

```bash
cd lore-web
$env:LORE_SERVER_BIN="D:\depot\lore\target\debug\loreserver.exe"; npm run test:e2e:auth-matrix
```

Expected: PASS if `D:\depot\lore\target\debug\loreserver.exe` exists and can start local test servers. If the binary is missing, record that dependency and run the default Playwright tests instead.

- [ ] **Step 7: Commit**

Run:

```bash
git add lore-web/tests/e2e/auth.spec.ts lore-web/tests/e2e/dashboard-shell.spec.ts lore-web/tests/e2e/live-auth-matrix.spec.ts
git commit -s -m "test: cover lore web auth page"
```

---

### Task 5: Full Verification And Polish Pass

**Files:**
- Review all files changed in Tasks 1-4.
- Optional docs update only if behavior differs from existing README auth documentation.

- [ ] **Step 1: Run lint**

Run:

```bash
cd lore-web
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
cd lore-web
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run unit tests**

Run:

```bash
cd lore-web
npm test
```

Expected: PASS.

- [ ] **Step 4: Run default Playwright suite**

Run:

```bash
cd lore-web
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
cd lore-web
npm run build
```

Expected: PASS.

- [ ] **Step 6: Verify Cargo workspace isolation**

Run:

```bash
git diff -- Cargo.toml Cargo.lock
```

Expected: no output.

- [ ] **Step 7: Verify server-only import boundary**

Run:

```bash
cd lore-web
npm test -- src/server/import-boundary.test.ts
```

Expected: PASS, confirming gRPC/proto imports stay out of client code.

- [ ] **Step 8: Manual Playwright visual QA**

Start the app:

```bash
cd lore-web
npm run dev -- --port 3000
```

Open `/auth` at desktop and mobile viewport widths. Verify:

- Buttons are clickable or intentionally disabled with visible reason.
- No text overlaps.
- No mobile horizontal overflow.
- The token input clears after save.
- The page feels visually consistent with the rest of Lore Web and more polished than the brainstorming mockup.

- [ ] **Step 9: Commit any final polish fixes**

If Step 8 finds fixes, commit them:

```bash
git add lore-web
git commit -s -m "fix: polish lore web auth page"
```

If no fixes are needed, do not create an empty commit.
