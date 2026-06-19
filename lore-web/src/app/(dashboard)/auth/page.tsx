import { getServerSession } from "next-auth";

import { AuthClient } from "@/components/auth/auth-client";
import { PageHeader } from "@/components/page-header";
import { authOptions } from "@/server/auth";
import { buildAuthPageState, safeAuthNextPath } from "@/server/auth-page";
import { readSessionSettingsResponse } from "@/server/session-settings";

export const dynamic = "force-dynamic";

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
    <>
      <PageHeader
        title="Auth"
        description="Sign-in state, bearer token storage, and OIDC diagnostics for this browser session."
        label="Session scoped"
      />

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
    </>
  );
}
