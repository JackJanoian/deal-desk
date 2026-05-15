import type { ExchangedTokens } from "./oauth.js";

export interface GmailTokensRecord {
  refreshToken: string;
  accessToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

/**
 * A minimal secret-store contract Gmail token persistence depends on.
 * Implementations adapt this to whatever underlying secret backend exists
 * (in production: companySecrets via secretService; in tests: an in-memory stub).
 */
export interface GmailSecretStore {
  store(args: {
    companyId: string;
    key: string;
    name: string;
    plaintext: string;
  }): Promise<{ secretId: string }>;
  loadLatest(args: { companyId: string; secretId: string }): Promise<string>;
}

export interface SaveGmailTokensInput {
  companyId: string;
  emailAddress: string;
  tokens: ExchangedTokens;
}

export async function saveGmailTokens(
  input: SaveGmailTokensInput,
  deps: { store: GmailSecretStore },
): Promise<string> {
  const key = `gmail_account:${input.emailAddress}`;
  const record: GmailTokensRecord = {
    refreshToken: input.tokens.refreshToken,
    accessToken: input.tokens.accessToken,
    expiresAt: Date.now() + input.tokens.expiresInSeconds * 1000,
    scope: input.tokens.scope,
  };
  const created = await deps.store.store({
    companyId: input.companyId,
    key,
    name: `Gmail OAuth (${input.emailAddress})`,
    plaintext: JSON.stringify(record),
  });
  return created.secretId;
}

export async function loadGmailTokens(
  args: { companyId: string; secretId: string },
  deps: { store: GmailSecretStore },
): Promise<GmailTokensRecord> {
  const raw = await deps.store.loadLatest({
    companyId: args.companyId,
    secretId: args.secretId,
  });
  return JSON.parse(raw) as GmailTokensRecord;
}

const REFRESH_THRESHOLD_MS = 60_000;

export interface RefreshDeps {
  fetch?: typeof fetch;
}

export interface EnsureFreshInput {
  tokens: GmailTokensRecord;
  clientId: string;
  clientSecret: string;
}

export async function ensureFreshAccessToken(
  input: EnsureFreshInput,
  deps: RefreshDeps = {},
): Promise<GmailTokensRecord> {
  if (input.tokens.expiresAt - Date.now() > REFRESH_THRESHOLD_MS) {
    return input.tokens;
  }
  const f = deps.fetch ?? fetch;
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.tokens.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return {
    ...input.tokens,
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}
