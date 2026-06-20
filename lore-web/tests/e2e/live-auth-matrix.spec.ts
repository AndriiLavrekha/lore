import { expect, test, type Browser, type Page } from "@playwright/test";
import { spawn, spawnSync, type ChildProcessByStdio } from "node:child_process";
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { promises as fs } from "node:fs";
import http, { type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";

type ManagedChild = ChildProcessByStdio<null, Readable, Readable>;

type ManagedProcess = {
  logs: () => string;
  stop: () => void;
};

type LoreServer = ManagedProcess & {
  grpcTarget: string;
  httpBase: string;
};

type JwtAuthority = {
  issuer: string;
  jwksUri: string;
  publicJwk: JsonWebKey;
  signAccessToken: (subject: string) => string;
  signIdToken: (subject: string, audience: string) => string;
};

type OidcProvider = {
  issuer: string;
  jwksUri: string;
  accessToken: string;
  stop: () => Promise<void>;
};

const ZERO_HASH = "0".repeat(64);
const CLIENT_ID = "lore-web-e2e";
const CLIENT_SECRET = "lore-web-e2e-secret";

test.describe.configure({ mode: "serial" });

test("no-auth mode performs repository, branch, and lock workflows against Lore", async ({ browser }) => {
  await usingLiveStack("none", async ({ page, baseUrl, lore }) => {
    await page.goto(`${baseUrl}/overview`);
    await expectCapability(page, "Auth state", "authenticated");

    const repo = await createRepositoryThroughUi(page, baseUrl, "auth-none");
    const branch = await createBranchThroughUi(page, baseUrl, repo.id, "branch-none");
    await exerciseLockWorkflow(page, baseUrl, repo.id, branch.id, "/auth-matrix/none.txt");
    await deleteRepositoryThroughUi(page, baseUrl, repo);

    expect(lore.grpcTarget).toMatch(/127\.0\.0\.1:\d+/);
  }, browser);
});

test("bearer mode blocks missing tokens and works after saving a JWT in Settings", async ({ browser }) => {
  const provider = await startOidcProvider();
  try {
    await usingLiveStack(
      "bearer",
      async ({ page, baseUrl }) => {
        await page.goto(`${baseUrl}/overview`);
        await expectCapability(page, "Auth state", "missing-token");

        await saveSettings(page, {
          authMode: "bearer",
          bearerToken: provider.accessToken,
        });

        await page.goto(`${baseUrl}/overview`);
        await expectCapability(page, "Auth state", "authenticated");

        const repo = await createRepositoryThroughUi(page, baseUrl, "auth-bearer");
        const branch = await createBranchThroughUi(page, baseUrl, repo.id, "branch-bearer");
        await exerciseLockWorkflow(page, baseUrl, repo.id, branch.id, "/auth-matrix/bearer.txt");
        await deleteRepositoryThroughUi(page, baseUrl, repo);
      },
      browser,
      { jwt: provider },
    );
  } finally {
    await provider.stop();
  }
});

test("oidc mode logs in through NextAuth and forwards the issued Lore access token", async ({ browser }) => {
  const provider = await startOidcProvider();
  try {
    await usingLiveStack(
      "oidc",
      async ({ page, baseUrl }) => {
        await page.goto(`${baseUrl}/settings`);
        await expect(page.getByRole("row", { name: /OIDC callback .* configured/ })).toBeVisible();
        await expect(page.getByRole("row", { name: /OIDC missing none server-only/ })).toBeVisible();
        await expect(page.getByRole("row", { name: /Token forwarding oidc-access-token/ })).toBeVisible();

        await page.goto(`${baseUrl}/auth?next=/repositories`);
        await expect(page.getByRole("heading", { name: "Auth", exact: true })).toBeVisible();
        await expect(statusTile(page, "Auth mode")).toContainText("sign in before requests can forward credentials");
        await expect(oidcRow(page, "Readiness")).toContainText("Ready");
        await expect(oidcPanel(page)).toContainText("Provider ready");
        await expect(oidcRow(page, "Access token")).toContainText("Not available");
        await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/repositories");

        await page.goto(`${baseUrl}/overview`);
        await expectCapability(page, "Auth state", "missing-token");

        await signInWithOidc(page, baseUrl);
        const session = await apiJson<{ hasAccessToken?: boolean }>(page, "/api/auth/session");
        expect(session.hasAccessToken).toBe(true);

        await page.goto(`${baseUrl}/auth?next=/repositories`);
        await expect(page.getByRole("heading", { name: "Auth", exact: true })).toBeVisible();
        await expect(oidcRow(page, "Readiness")).toContainText("Ready");
        await expect(oidcRow(page, "Access token")).toContainText("Available");
        await expect(statusTile(page, "Forwarding")).toContainText("OIDC access token");
        await expect(statusTile(page, "Forwarding")).toContainText(
          "Current OIDC access token will be forwarded with server requests.",
        );
        await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/repositories");

        await page.goto(`${baseUrl}/overview`);
        await expectCapability(page, "Auth state", "authenticated");

        const repo = await createRepositoryThroughUi(page, baseUrl, "auth-oidc");
        const branch = await createBranchThroughUi(page, baseUrl, repo.id, "branch-oidc");
        await exerciseLockWorkflow(page, baseUrl, repo.id, branch.id, "/auth-matrix/oidc.txt");
        await deleteRepositoryThroughUi(page, baseUrl, repo);
      },
      browser,
      { jwt: provider },
    );
  } finally {
    await provider.stop();
  }
});

async function usingLiveStack(
  authMode: "none" | "bearer" | "oidc",
  run: (context: { page: Page; baseUrl: string; lore: LoreServer }) => Promise<void>,
  browser: Browser,
  options: { jwt?: OidcProvider } = {},
) {
  const portBase = await reservePortBase();
  const lore = await startLoreServer({
    grpcPort: portBase,
    httpPort: portBase + 1,
    jwt: options.jwt,
  });
  const next = await startNextServer({
    port: portBase + 2,
    authMode,
    grpcTarget: lore.grpcTarget,
    httpBase: lore.httpBase,
    oidcIssuer: options.jwt?.issuer,
  });
  const baseUrl = `http://127.0.0.1:${portBase + 2}`;
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  try {
    await run({ page, baseUrl, lore });
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n\nLore logs:\n${lore.logs()}\n\nNext logs:\n${next.logs()}`,
    );
  } finally {
    await context.close();
    next.stop();
    lore.stop();
  }
}

async function startLoreServer({
  grpcPort,
  httpPort,
  jwt,
}: {
  grpcPort: number;
  httpPort: number;
  jwt?: OidcProvider;
}): Promise<LoreServer> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lore-web-live-"));
  const configDir = path.join(root, "config");
  const storeDir = path.join(root, "store");
  await fs.mkdir(configDir, { recursive: true });
  await fs.mkdir(storeDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, "local.toml"),
    loreServerConfig({ grpcPort, httpPort, storeDir, jwt }),
  );

  const child = spawn(resolveLoreServerBinary(), ["--config", configDir, "--env", "e2e"], {
    cwd: resolveRepoRoot(),
    env: { ...process.env, RUST_LOG: process.env.RUST_LOG ?? "warn" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const managed = manageProcess(child);
  const httpBase = `http://127.0.0.1:${httpPort}`;
  await waitForUrl(`${httpBase}/health_check`, child, managed.logs, 45_000);

  return {
    ...managed,
    grpcTarget: `127.0.0.1:${grpcPort}`,
    httpBase,
  };
}

async function startNextServer({
  port,
  authMode,
  grpcTarget,
  httpBase,
  oidcIssuer,
}: {
  port: number;
  authMode: "none" | "bearer" | "oidc";
  grpcTarget: string;
  httpBase: string;
  oidcIssuer?: string;
}): Promise<ManagedProcess> {
  const workspace = await prepareNextWorkspace();
  const nextCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const env = compactEnv({
    ...process.env,
    LORE_WEB_GRPC_TARGET: grpcTarget,
    LORE_WEB_HTTP_BASE: httpBase,
    LORE_WEB_GRPC_TLS: "insecure",
    LORE_WEB_AUTH_MODE: authMode,
    AUTH_SECRET: "live-auth-matrix-secret-live-auth-matrix-secret",
    AUTH_URL: `http://127.0.0.1:${port}`,
    NEXTAUTH_URL: `http://127.0.0.1:${port}`,
    AUTH_OIDC_ISSUER: oidcIssuer,
    AUTH_OIDC_CLIENT_ID: CLIENT_ID,
    AUTH_OIDC_CLIENT_SECRET: CLIENT_SECRET,
  });
  const child = spawn(process.execPath, [nextCli, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: workspace,
    env: env as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const managed = manageProcess(child);
  await waitForUrl(`http://127.0.0.1:${port}/settings`, child, managed.logs, 90_000);
  return {
    logs: managed.logs,
    stop: () => {
      managed.stop();
      void fs.rm(workspace, { recursive: true, force: true });
    },
  };
}

async function startOidcProvider(): Promise<OidcProvider> {
  const codes = new Map<string, string>();
  const port = await reserveSinglePort();
  const issuer = `http://127.0.0.1:${port}`;
  const authority = createJwtAuthority(issuer);
  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", authority.issuer);
    if (requestUrl.pathname === "/.well-known/openid-configuration") {
      sendJson(response, 200, {
        issuer: authority.issuer,
        authorization_endpoint: `${authority.issuer}/authorize`,
        token_endpoint: `${authority.issuer}/token`,
        jwks_uri: authority.jwksUri,
        userinfo_endpoint: `${authority.issuer}/userinfo`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
        scopes_supported: ["openid", "profile", "email"],
      });
      return;
    }

    if (requestUrl.pathname === "/jwks.json") {
      sendJson(response, 200, { keys: [authority.publicJwk] });
      return;
    }

    if (requestUrl.pathname === "/authorize") {
      const code = `code-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      codes.set(code, "lore-web-oidc-user");
      const redirect = new URL(requestUrl.searchParams.get("redirect_uri") ?? "");
      redirect.searchParams.set("code", code);
      const state = requestUrl.searchParams.get("state");
      if (state) redirect.searchParams.set("state", state);
      response.writeHead(302, { Location: redirect.toString() });
      response.end();
      return;
    }

    if (requestUrl.pathname === "/token" && request.method === "POST") {
      const body = await readRequestBody(request);
      const params = new URLSearchParams(body);
      const subject = codes.get(params.get("code") ?? "") ?? "lore-web-oidc-user";
      sendJson(response, 200, {
        access_token: authority.signAccessToken(subject),
        id_token: authority.signIdToken(subject, CLIENT_ID),
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid profile email",
      });
      return;
    }

    if (requestUrl.pathname === "/userinfo") {
      sendJson(response, 200, {
        sub: "lore-web-oidc-user",
        name: "Lore Web OIDC User",
        email: "lore-web-oidc@example.test",
      });
      return;
    }

    sendJson(response, 404, { error: "not found" });
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

  return {
    issuer,
    jwksUri: authority.jwksUri,
    accessToken: authority.signAccessToken("lore-web-bearer-user"),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function loreServerConfig({
  grpcPort,
  httpPort,
  storeDir,
  jwt,
}: {
  grpcPort: number;
  httpPort: number;
  storeDir: string;
  jwt?: OidcProvider;
}) {
  return `
[server.quic]
enabled = false
host = "127.0.0.1"
port = ${grpcPort}

[server.grpc]
enabled = true
host = "127.0.0.1"
port = ${grpcPort}
verify_client_certs = false
request_handler_timeout_seconds = 20

[server.http]
enabled = true
host = "127.0.0.1"
port = ${httpPort}

[immutable_store.local]
path = ${tomlString(storeDir)}
flush_delay_seconds = 0

[mutable_store.local]
path = ${tomlString(storeDir)}
flush_delay_seconds = 0

${jwt ? `[server.auth]\njwt_issuer = ${tomlString(jwt.issuer)}\njwt_audience = ["Lore"]\n\n[server.auth.jwk]\nendpoint = ${tomlString(jwt.jwksUri)}\n` : ""}
`;
}

function createJwtAuthority(issuer: string): JwtAuthority {
  const kid = `lore-web-e2e-${Date.now()}`;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: "jwk" });
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  return {
    issuer,
    jwksUri: `${issuer}/jwks.json`,
    publicJwk,
    signAccessToken: (subject) =>
      signJwt(privateKey, kid, {
        sub: subject,
        iss: issuer,
        iat: unixNow(),
        exp: unixNow() + 3600,
        aud: "Lore",
        env: "e2e",
        name: "Lore Web E2E",
        preferred_username: subject,
        resources: [{ resource_id: "urc-*", permission: ["read", "write", "admin", "owner", "obliterate"] }],
        groups: ["lore-web-e2e"],
        is_service_account: true,
        idp: "playwright",
      }),
    signIdToken: (subject, audience) =>
      signJwt(privateKey, kid, {
        sub: subject,
        iss: issuer,
        iat: unixNow(),
        exp: unixNow() + 3600,
        aud: audience,
        name: "Lore Web OIDC User",
        email: "lore-web-oidc@example.test",
      }),
  };
}

function signJwt(privateKey: KeyObject, kid: string, payload: Record<string, unknown>) {
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid });
  const body = base64UrlJson(payload);
  const signature = createSign("RSA-SHA256").update(`${header}.${body}`).sign(privateKey);
  return `${header}.${body}.${base64Url(signature)}`;
}

async function saveSettings(
  page: Page,
  options: {
    authMode: "none" | "bearer" | "oidc";
    bearerToken?: string;
  },
) {
  await page.goto("/settings");
  await page.getByLabel("Auth mode").selectOption(options.authMode);
  if (options.bearerToken) {
    await page.getByLabel("Bearer token").fill(options.bearerToken);
  }
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");
}

async function signInWithOidc(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/api/auth/signin/oidc?callbackUrl=${encodeURIComponent(`${baseUrl}/repositories`)}`);
  const signInButton = page.getByRole("button", { name: /sign in with oidc/i });
  if (await signInButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await signInButton.click();
  }
  await expect(page).toHaveURL(/\/repositories$/, { timeout: 45_000 });
}

async function createRepositoryThroughUi(page: Page, baseUrl: string, namePrefix: string) {
  const name = `${namePrefix}-${Date.now().toString(36)}`;
  await page.goto(`${baseUrl}/repositories`);
  await page.getByRole("textbox", { name: "New repository name" }).fill(name);
  await page.getByRole("textbox", { name: "Repository description" }).fill(`Created by ${namePrefix} live auth matrix`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("status")).toContainText(`Created ${name}.`, { timeout: 20_000 });
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  const repositories = await apiJson<{ items: Array<{ id: string; name: string }> }>(page, "/api/repositories");
  const repo = repositories.items.find((item) => item.name === name);
  if (!repo) throw new Error(`created repository ${name} was not returned by /api/repositories`);
  return repo;
}

async function createBranchThroughUi(page: Page, baseUrl: string, repoId: string, namePrefix: string) {
  const name = `${namePrefix}-${Date.now().toString(36)}`;
  await page.goto(`${baseUrl}/repositories/${repoId}/branches`);
  await expect(page.getByRole("status")).toContainText(/Loaded \d+ branches/, { timeout: 20_000 });
  await page.getByRole("textbox", { name: "Branch name" }).fill(name);
  await page.getByRole("button", { name: "Create branch" }).click();
  await expect(page.getByRole("status")).toContainText(`Created branch ${name}.`, { timeout: 20_000 });
  const branches = await apiJson<{ items: Array<{ id: string; name: string }> }>(
    page,
    `/api/repositories/${repoId}/branches`,
  );
  const branch = branches.items.find((item) => item.name === name);
  if (!branch) throw new Error(`created branch ${name} was not returned by /api/repositories/${repoId}/branches`);
  return branch;
}

async function exerciseLockWorkflow(page: Page, baseUrl: string, repoId: string, branchId: string, description: string) {
  await page.goto(`${baseUrl}/repositories/${repoId}/locks`);
  await expect(page.getByRole("status")).toContainText(/No locks matched|Loaded \d+ locks/, { timeout: 20_000 });
  await page.getByLabel("Branch filter").fill(branchId);
  await page.getByLabel("Path filter").fill(description);
  await page.getByLabel("Lock resource hash").fill(ZERO_HASH);
  await page.getByRole("button", { name: "Acquire lock" }).click();
  await expect(page.getByRole("status")).toContainText("Lock acquire requested.", { timeout: 20_000 });
  await expect(page.getByRole("row", { name: new RegExp(description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();
  await page.getByRole("button", { name: "Release lock" }).click();
  await expect(page.getByRole("status")).toContainText("Lock release requested.", { timeout: 20_000 });
}

async function deleteRepositoryThroughUi(page: Page, baseUrl: string, repo: { id: string; name: string }) {
  await page.goto(`${baseUrl}/repositories`);
  const row = page.getByRole("row", { name: new RegExp(repo.name) });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: "Select" }).click();
  await page.getByLabel("Delete confirmation").fill(`${repo.name} ${repo.id}`);
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(page.getByRole("status")).toContainText(`Deleted ${repo.name}.`, { timeout: 20_000 });
}

async function expectCapability(page: Page, label: string, value: string) {
  const card = page.locator("section").filter({ hasText: label }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  const text = await card.textContent();
  await expect(card.getByText(value, { exact: true }), `${label} card text: ${text}`).toBeVisible({ timeout: 20_000 });
}

function statusTile(page: Page, label: string) {
  return page.getByRole("group", { name: label });
}

function oidcRow(page: Page, label: string) {
  return page.locator("dl div").filter({ hasText: new RegExp(`^${label}`) }).first();
}

function oidcPanel(page: Page) {
  return page.getByRole("group", { name: "OIDC" });
}

async function apiJson<T>(page: Page, url: string): Promise<T> {
  const response = await page.request.get(url);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as T;
}

function manageProcess(child: ManagedChild): ManagedProcess {
  let logs = "";
  const append = (data: Buffer) => {
    logs = `${logs}${data.toString()}`.slice(-12_000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  return {
    logs: () => logs,
    stop: () => stopProcessTree(child),
  };
}

async function waitForUrl(
  url: string,
  child: ManagedChild,
  logs: () => string,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`process exited before ${url} was ready\n${logs()}`);
    }

    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // Keep polling until the process reports readiness or exits.
    }

    await sleep(500);
  }

  throw new Error(`timed out waiting for ${url}\n${logs()}`);
}

async function reservePortBase() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const base = 43_000 + Math.floor(Math.random() * 8_000);
    if (await portsAreAvailable([base, base + 1, base + 2])) return base;
  }
  throw new Error("could not reserve a three-port range for the live auth matrix");
}

async function reserveSinglePort() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const port = 51_000 + Math.floor(Math.random() * 10_000);
    if (await portsAreAvailable([port])) return port;
  }
  throw new Error("could not reserve a TCP port");
}

function resolveRepoRoot() {
  const cwd = process.cwd();
  const marker = `${path.sep}.worktrees${path.sep}`;
  const index = cwd.indexOf(marker);
  if (index >= 0) return cwd.slice(0, index);
  return path.resolve(cwd, "..");
}

function resolveLoreServerBinary() {
  if (process.env.LORE_SERVER_BIN) return process.env.LORE_SERVER_BIN;
  const binary = process.platform === "win32" ? "loreserver.exe" : "loreserver";
  return path.join(resolveRepoRoot(), "target", "debug", binary);
}

async function prepareNextWorkspace() {
  const source = process.cwd();
  const workspace = await fs.mkdtemp(path.join(path.dirname(source), ".live-next-"));
  await fs.cp(source, workspace, {
    recursive: true,
    filter: (src) => {
      const basename = path.basename(src);
      return !["node_modules", ".next", "test-results", "playwright-report"].includes(basename);
    },
  });
  await fs.symlink(path.join(source, "node_modules"), path.join(workspace, "node_modules"), "junction");
  await fs.symlink(path.join(resolveRepoRoot(), "lore-proto"), path.join(workspace, "lore-proto"), "junction");
  return workspace;
}

function stopProcessTree(child: ManagedChild) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function base64UrlJson(value: unknown) {
  return base64Url(Buffer.from(JSON.stringify(value)));
}

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function tomlString(value: string) {
  return JSON.stringify(value.replace(/\\/g, "/"));
}

function compactEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] =>
        Boolean(entry[0]) && !entry[0].startsWith("=") && typeof entry[1] === "string",
    ),
  );
}

async function portsAreAvailable(ports: number[]) {
  const servers: http.Server[] = [];
  try {
    for (const port of ports) {
      const server = http.createServer();
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      });
      servers.push(server);
    }
    return true;
  } catch {
    return false;
  } finally {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
