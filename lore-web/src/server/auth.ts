import { headers } from "next/headers";
import type { NextAuthOptions } from "next-auth";
import { getToken } from "next-auth/jwt";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { z } from "zod";

const authEnvSchema = z.object({
  AUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_OIDC_ISSUER: z.string().url().optional(),
  AUTH_OIDC_CLIENT_ID: z.string().min(1).optional(),
  AUTH_OIDC_CLIENT_SECRET: z.string().min(1).optional(),
});

type AuthEnv = Record<string, string | undefined>;
type OidcProfile = {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
};

export type OidcRuntimeStatus = {
  enabled: boolean;
  missing: string[];
  callbackUrl: string;
  tokenForwarding: "oidc-access-token" | "bearer-cookie" | "disabled";
};

function authBaseUrl(env: z.infer<typeof authEnvSchema>) {
  return env.AUTH_URL ?? env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";
}

function authSecret(env: z.infer<typeof authEnvSchema>) {
  return env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
}

export function getOidcRuntimeStatus(env: AuthEnv = process.env): OidcRuntimeStatus {
  const parsed = authEnvSchema.parse(env);
  const requiredValues = [
    { name: "AUTH_SECRET", value: authSecret(parsed) },
    { name: "AUTH_OIDC_ISSUER", value: parsed.AUTH_OIDC_ISSUER },
    { name: "AUTH_OIDC_CLIENT_ID", value: parsed.AUTH_OIDC_CLIENT_ID },
    { name: "AUTH_OIDC_CLIENT_SECRET", value: parsed.AUTH_OIDC_CLIENT_SECRET },
  ];
  const missing = requiredValues.filter(({ value }) => !value).map(({ name }) => name);

  const enabled = missing.length === 0;

  return {
    enabled,
    missing,
    callbackUrl: `${authBaseUrl(parsed).replace(/\/$/, "")}/api/auth/callback/oidc`,
    tokenForwarding: enabled ? "oidc-access-token" : "disabled",
  };
}

export function buildAuthOptions(env: AuthEnv = process.env): NextAuthOptions {
  const parsed = authEnvSchema.parse(env);
  const status = getOidcRuntimeStatus(env);
  const providers =
    status.enabled &&
    parsed.AUTH_OIDC_ISSUER &&
    parsed.AUTH_OIDC_CLIENT_ID &&
    parsed.AUTH_OIDC_CLIENT_SECRET
      ? [
          {
            id: "oidc",
            name: "OIDC",
            type: "oauth",
            issuer: parsed.AUTH_OIDC_ISSUER,
            idToken: true,
            checks: ["pkce", "state"],
            clientId: parsed.AUTH_OIDC_CLIENT_ID,
            clientSecret: parsed.AUTH_OIDC_CLIENT_SECRET,
            authorization: {
              params: {
                scope: "openid profile email",
              },
            },
            profile(profile) {
              return {
                id: String(profile.sub ?? profile.id ?? profile.email),
                name: typeof profile.name === "string" ? profile.name : undefined,
                email: typeof profile.email === "string" ? profile.email : undefined,
              };
            },
          } satisfies OAuthConfig<OidcProfile>,
        ]
      : [];

  return {
    secret: authSecret(parsed),
    session: {
      strategy: "jwt",
    },
    providers,
    callbacks: {
      async jwt({ token, account }) {
        if (typeof account?.access_token === "string") {
          token.accessToken = account.access_token;
        }

        return token;
      },
      async session({ session, token }) {
        return {
          ...session,
          hasAccessToken: typeof token.accessToken === "string",
        };
      },
    },
  };
}

export const authOptions = buildAuthOptions();

export async function getServerOidcAccessToken(env: AuthEnv = process.env) {
  const parsed = authEnvSchema.parse(env);
  const secret = authSecret(parsed);

  if (!secret) {
    return undefined;
  }

  const headerStore = await headers();
  const token = await getToken({
    req: {
      headers: Object.fromEntries(headerStore.entries()),
    } as never,
    secret,
  });

  return typeof token?.accessToken === "string" ? token.accessToken : undefined;
}
