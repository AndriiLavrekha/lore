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
