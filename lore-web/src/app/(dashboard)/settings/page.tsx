import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";
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
        label="Read only"
      />

      <PlaceholderTable
        columns={["Setting", "Value", "State"]}
        rows={[
          ["LORE_WEB_GRPC_TARGET", config.grpcTarget, "gRPC BFF target"],
          ["LORE_WEB_HTTP_BASE", config.httpBase, "HTTP health base"],
          ["LORE_WEB_GRPC_TLS", config.grpcTls, "gRPC transport"],
          ["LORE_WEB_AUTH_MODE", config.authMode, "Auth strategy"],
          ["LORE_WEB_NOTIFICATION_STREAM", config.notificationStream ?? "unset", "Activity stream"],
          ["OIDC callback", oidc.callbackUrl, oidc.enabled ? "configured" : "missing config"],
          ["OIDC missing", oidc.missing.join(", ") || "none", "server-only"],
          ["Token forwarding", tokenForwarding, "Authorization metadata"],
        ]}
      />
    </>
  );
}
