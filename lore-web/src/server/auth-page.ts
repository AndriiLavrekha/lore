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

  if (
    parsed.pathname === "/auth" ||
    parsed.pathname.startsWith("/auth/") ||
    parsed.pathname.startsWith("/api/")
  ) {
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
