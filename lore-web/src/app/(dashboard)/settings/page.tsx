import { PageHeader } from "@/components/page-header";
import { SettingsClient } from "@/components/settings/settings-client";
import { getOidcRuntimeStatus } from "@/server/auth";
import { getServerConfig } from "@/server/config";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const config = getServerConfig();
  const oidc = getOidcRuntimeStatus();
  const tokenForwarding =
    config.authMode === "oidc"
      ? oidc.tokenForwarding
      : config.authMode === "bearer"
        ? "bearer-cookie"
        : "disabled";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Connection defaults and session override fields for the Lore dashboard BFF."
        label="Session scoped"
      />

      <SettingsClient
        initialSettings={{
          ...config,
          hasBearerToken: false,
          oidc: {
            ...oidc,
            tokenForwarding,
          },
        }}
      />
    </>
  );
}
