import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/placeholder-table";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Connection defaults for local development. Cookie-backed overrides, bearer tokens, and OIDC are added in later phases."
        label="Read only"
      />

      <PlaceholderTable
        columns={["Setting", "Default", "Phase"]}
        rows={[
          ["LORE_WEB_GRPC_TARGET", "127.0.0.1:41337", "Phase 1"],
          ["LORE_WEB_HTTP_BASE", "http://127.0.0.1:41339", "Phase 2"],
          ["LORE_WEB_GRPC_TLS", "insecure", "Phase 1"],
          ["LORE_WEB_AUTH_MODE", "none", "Phase 2"],
          ["LORE_WEB_NOTIFICATION_STREAM", "unset", "Phase 8"],
        ]}
      />
    </>
  );
}
