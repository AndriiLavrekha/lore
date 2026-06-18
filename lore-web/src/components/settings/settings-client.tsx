"use client";

import { Loader2, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SettingsResponse } from "@/server/settings";

type RequestState = { tone: "idle" | "success" | "error"; message: string };

const inputClass = "h-9 rounded-md border bg-background px-3 text-sm";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }
  return payload;
}

export function SettingsClient({ initialSettings }: { initialSettings: SettingsResponse }) {
  const [grpcTarget, setGrpcTarget] = useState(initialSettings.grpcTarget);
  const [httpBase, setHttpBase] = useState(initialSettings.httpBase);
  const [grpcTls, setGrpcTls] = useState(initialSettings.grpcTls);
  const [authMode, setAuthMode] = useState(initialSettings.authMode);
  const [notificationStream, setNotificationStream] = useState(initialSettings.notificationStream ?? "");
  const [bearerToken, setBearerToken] = useState("");
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<RequestState>({ tone: "idle", message: "Settings are loaded." });

  async function save() {
    setLoading(true);
    try {
      const payload = await readJson<SettingsResponse>(
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grpcTarget: grpcTarget.trim(),
            httpBase: httpBase.trim(),
            grpcTls,
            authMode,
            notificationStream: notificationStream.trim() || undefined,
            bearerToken: bearerToken.trim() || undefined,
          }),
        }),
      );
      setSettings(payload);
      setBearerToken("");
      setState({ tone: "success", message: "Settings saved for this browser session." });
    } catch (error) {
      setState({ tone: "error", message: error instanceof Error ? error.message : "Settings save failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-lg border bg-card/95 p-4 shadow-sm lg:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          LORE_WEB_GRPC_TARGET
          <input aria-label="gRPC target" className={inputClass} value={grpcTarget} onChange={(event) => setGrpcTarget(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          LORE_WEB_HTTP_BASE
          <input aria-label="HTTP base" className={inputClass} value={httpBase} onChange={(event) => setHttpBase(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          LORE_WEB_GRPC_TLS
          <select aria-label="gRPC TLS mode" className={inputClass} value={grpcTls} onChange={(event) => setGrpcTls(event.target.value as SettingsResponse["grpcTls"])}>
            <option value="insecure">insecure</option>
            <option value="tls">tls</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          LORE_WEB_AUTH_MODE
          <select aria-label="Auth mode" className={inputClass} value={authMode} onChange={(event) => setAuthMode(event.target.value as SettingsResponse["authMode"])}>
            <option value="none">none</option>
            <option value="bearer">bearer</option>
            <option value="oidc">oidc</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          LORE_WEB_NOTIFICATION_STREAM
          <input aria-label="Notification stream" className={inputClass} value={notificationStream} onChange={(event) => setNotificationStream(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Bearer token
          <input aria-label="Bearer token" className={inputClass} type="password" value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} placeholder={settings.hasBearerToken ? "token already stored" : "optional"} />
        </label>
        <div className="lg:col-span-2">
          <Button type="button" onClick={save} disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            Save settings
          </Button>
        </div>
      </div>

      <div
        role="status"
        className={`rounded-md border px-3 py-2 text-sm ${
          state.tone === "error" ? "border-destructive/40 text-destructive" : "text-muted-foreground"
        }`}
      >
        {state.message}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card/95 shadow-sm">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <thead className="bg-muted text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Setting</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">State</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[
              ["LORE_WEB_GRPC_TARGET", settings.grpcTarget, "gRPC BFF target"],
              ["LORE_WEB_HTTP_BASE", settings.httpBase, "HTTP health base"],
              ["LORE_WEB_GRPC_TLS", settings.grpcTls, "gRPC transport"],
              ["LORE_WEB_AUTH_MODE", settings.authMode, "Auth strategy"],
              ["LORE_WEB_NOTIFICATION_STREAM", settings.notificationStream ?? "unset", "Activity stream"],
              ["OIDC callback", settings.oidc.callbackUrl, settings.oidc.enabled ? "configured" : "missing config"],
              ["OIDC missing", settings.oidc.missing.join(", ") || "none", "server-only"],
              ["Token forwarding", settings.oidc.tokenForwarding, settings.hasBearerToken ? "bearer stored" : "no bearer cookie"],
            ].map((row) => (
              <tr key={row[0]} className="hover:bg-muted/45">
                <td className="px-4 py-3 font-medium">{row[0]}</td>
                <td className="truncate px-4 py-3 font-mono text-xs">{row[1]}</td>
                <td className="px-4 py-3 text-muted-foreground">{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
