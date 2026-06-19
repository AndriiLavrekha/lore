"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Radio,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

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

type AuthClientProps = {
  initialSettings: SettingsResponse;
  state: AuthPageState;
  oidcSession: OidcSessionState;
};

type RequestState = { tone: "idle" | "success" | "error"; message: string };

const inputClass =
  "h-10 min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text
    ? (JSON.parse(text) as T & { error?: string })
    : ({} as T & { error?: string });

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }

  return payload;
}

function modeLabel(mode: SettingsResponse["authMode"]) {
  switch (mode) {
    case "bearer":
      return "Bearer token";
    case "oidc":
      return "OIDC";
    case "none":
      return "No auth";
  }
}

function forwardingLabel(value: SettingsResponse["oidc"]["tokenForwarding"]) {
  switch (value) {
    case "oidc-access-token":
      return "OIDC access token";
    case "bearer-cookie":
      return "Bearer cookie";
    case "disabled":
      return "Disabled";
  }
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />
  ) : (
    <AlertTriangle aria-hidden="true" className="size-4 text-amber-600" />
  );
}

export function AuthClient({ initialSettings, state, oidcSession }: AuthClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [bearerToken, setBearerToken] = useState("");
  const [savingBearer, setSavingBearer] = useState(false);
  const [clearingBearer, setClearingBearer] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>({
    tone: "idle",
    message: "Auth settings are loaded.",
  });

  const currentState = useMemo(
    () => ({
      primaryMode: settings.authMode,
      nextPath: state.nextPath,
      oidcReady: settings.authMode === "oidc" && settings.oidc.enabled,
      bearerReady: settings.authMode === "bearer" && settings.hasBearerToken,
      disabled: settings.authMode === "none",
    }),
    [settings, state.nextPath],
  );

  const callbackUrl = currentState.nextPath ?? "/overview";
  const missingOidc = settings.oidc.missing.length > 0 ? settings.oidc.missing.join(", ") : "None";
  const displayName = oidcSession.name ?? oidcSession.email ?? "Signed in";

  async function saveBearerToken() {
    setSavingBearer(true);
    try {
      const payload = await readJson<SettingsResponse>(
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bearerToken: bearerToken.trim(),
            authMode: "bearer",
          }),
        }),
      );
      setSettings(payload);
      setBearerToken("");
      setRequestState({
        tone: "success",
        message: "Bearer token saved for this browser session.",
      });
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "Bearer token save failed.",
      });
    } finally {
      setSavingBearer(false);
    }
  }

  async function clearBearerToken() {
    setClearingBearer(true);
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
      setRequestState({
        tone: "success",
        message: "Bearer token cleared for this browser session.",
      });
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "Bearer token clear failed.",
      });
    } finally {
      setClearingBearer(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Session auth</h2>
                <Badge variant={currentState.disabled ? "outline" : "secondary"}>
                  {modeLabel(currentState.primaryMode)}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Auth choices are scoped to this browser session. Tokens are saved server-side in
                HTTP-only cookies and are never shown after save.
              </p>
            </div>
            {currentState.nextPath ? (
              <Button asChild size="sm" className="w-fit">
                <Link href={currentState.nextPath}>
                  <ArrowRight aria-hidden="true" />
                  Continue
                </Link>
              </Button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatusTile
              label="Auth mode"
              value={currentState.disabled ? "Disabled" : modeLabel(currentState.primaryMode)}
              ok={!currentState.disabled}
              detail={
                currentState.disabled
                  ? "Requests are sent without credentials."
                  : "Requests can forward configured credentials."
              }
            />
            <StatusTile
              label="Current target"
              value={settings.grpcTarget}
              ok
              detail={`${settings.grpcTls} gRPC transport`}
            />
            <StatusTile
              label="Requested next"
              value={currentState.nextPath ?? "None"}
              ok={Boolean(currentState.nextPath)}
              detail="Validated same-origin dashboard destination."
            />
            <StatusTile
              label="Forwarding"
              value={forwardingLabel(settings.oidc.tokenForwarding)}
              ok={settings.oidc.tokenForwarding !== "disabled"}
              detail="Credential source used by server requests."
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">OIDC session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Browser sign-in for providers configured on the server.
              </p>
            </div>
            <Badge variant={oidcSession.authenticated ? "default" : "outline"}>
              {oidcSession.authenticated ? "Signed in" : "Signed out"}
            </Badge>
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <DiagnosticRow
              label="Readiness"
              value={settings.oidc.enabled ? "Ready" : "Missing config"}
              ok={settings.oidc.enabled}
            />
            <DiagnosticRow label="Missing" value={missingOidc} ok={settings.oidc.enabled} />
            <DiagnosticRow
              label="Callback URL"
              value={settings.oidc.callbackUrl}
              ok={settings.oidc.enabled}
            />
            <DiagnosticRow
              label="Access token"
              value={oidcSession.hasAccessToken ? "Available" : "Not available"}
              ok={oidcSession.hasAccessToken}
            />
            <DiagnosticRow
              label="Identity"
              value={oidcSession.authenticated ? displayName : "Not signed in"}
              ok={oidcSession.authenticated}
            />
          </dl>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void signIn("oidc", { callbackUrl })}
              disabled={!currentState.oidcReady}
              className="w-full sm:w-auto"
            >
              <LogIn aria-hidden="true" />
              Sign in with OIDC
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut({ callbackUrl: "/auth" })}
              disabled={!oidcSession.authenticated}
              className="w-full sm:w-auto"
            >
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,1.15fr)]">
        <div className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Bearer token</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Store a token for this session without rendering the saved value.
              </p>
            </div>
            <Badge variant={settings.hasBearerToken ? "default" : "outline"}>
              {settings.hasBearerToken ? "Stored" : "Not stored"}
            </Badge>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Bearer token
              <input
                aria-label="Bearer token"
                className={inputClass}
                type="password"
                value={bearerToken}
                onChange={(event) => setBearerToken(event.target.value)}
                placeholder={settings.hasBearerToken ? "Token already stored" : "Paste token"}
                autoComplete="off"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={() => void saveBearerToken()}
                disabled={savingBearer || bearerToken.trim().length === 0}
                className="w-full sm:w-auto"
              >
                {savingBearer ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <KeyRound aria-hidden="true" />
                )}
                Save bearer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void clearBearerToken()}
                disabled={clearingBearer || !settings.hasBearerToken}
                className="w-full sm:w-auto"
              >
                {clearingBearer ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                Clear bearer
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card/95 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Routing diagnostics</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm which credential path the dashboard will use before continuing.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/settings">
                <Settings aria-hidden="true" />
                Settings
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DiagnosticPanel
              icon={<Radio aria-hidden="true" className="size-4" />}
              label="OIDC"
              status={currentState.oidcReady ? "Ready" : "Unavailable"}
              detail={
                settings.oidc.enabled
                  ? `Callback: ${settings.oidc.callbackUrl}`
                  : `Missing: ${missingOidc}`
              }
              ok={currentState.oidcReady}
            />
            <DiagnosticPanel
              icon={<KeyRound aria-hidden="true" className="size-4" />}
              label="Bearer"
              status={currentState.bearerReady ? "Ready" : "Unavailable"}
              detail={settings.hasBearerToken ? "Bearer cookie is stored." : "No bearer cookie stored."}
              ok={currentState.bearerReady}
            />
          </div>
        </div>
      </section>

      <div
        role="status"
        aria-live="polite"
        className={`rounded-md border px-3 py-2 text-sm ${
          requestState.tone === "error"
            ? "border-destructive/40 text-destructive"
            : requestState.tone === "success"
              ? "border-emerald-500/30 text-emerald-700"
              : "text-muted-foreground"
        }`}
      >
        {requestState.message}
      </div>
    </div>
  );
}

function StatusTile({
  label,
  value,
  detail,
  ok,
}: {
  label: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/35 p-3">
      <div className="flex items-center gap-2">
        <StatusIcon ok={ok} />
        <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function DiagnosticRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="grid gap-1 border-t px-1 py-3 first:border-t-0 sm:grid-cols-[112px_minmax(0,1fr)]">
      <dt className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <StatusIcon ok={ok} />
        {label}
      </dt>
      <dd className="min-w-0 break-words font-mono text-xs">{value}</dd>
    </div>
  );
}

function DiagnosticPanel({
  icon,
  label,
  status,
  detail,
  ok,
}: {
  icon: ReactNode;
  label: string;
  status: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        <Badge variant={ok ? "secondary" : "outline"}>{status}</Badge>
      </div>
      <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}
