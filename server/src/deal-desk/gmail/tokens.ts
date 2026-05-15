import type { ExchangedTokens } from "./oauth";

export interface GmailTokensRecord {
  refreshToken: string;
  accessToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

export interface SecretServiceLike {
  createSecret: (args: {
    companyId: string;
    key: string;
    name: string;
    description?: string;
  }) => Promise<{ id: string }>;
  addVersion: (args: { secretId: string; key: string; value: string }) => Promise<{ version: number }>;
  getLatestPlaintext: (args: { secretId: string }) => Promise<string>;
}

export interface SaveGmailTokensInput {
  companyId: string;
  emailAddress: string;
  tokens: ExchangedTokens;
}

export interface SaveDeps {
  secretService: SecretServiceLike;
}

export async function saveGmailTokens(
  input: SaveGmailTokensInput,
  deps: SaveDeps,
): Promise<string> {
  const key = `gmail_account:${input.emailAddress}`;
  const created = await deps.secretService.createSecret({
    companyId: input.companyId,
    key,
    name: `Gmail OAuth (${input.emailAddress})`,
    description: "Gmail OAuth refresh + access tokens for Outreach Analyst",
  });
  const record: GmailTokensRecord = {
    refreshToken: input.tokens.refreshToken,
    accessToken: input.tokens.accessToken,
    expiresAt: Date.now() + input.tokens.expiresInSeconds * 1000,
    scope: input.tokens.scope,
  };
  await deps.secretService.addVersion({
    secretId: created.id,
    key,
    value: JSON.stringify(record),
  });
  return created.id;
}

export async function loadGmailTokens(
  args: { secretId: string },
  deps: SaveDeps,
): Promise<GmailTokensRecord> {
  const raw = await deps.secretService.getLatestPlaintext({ secretId: args.secretId });
  return JSON.parse(raw) as GmailTokensRecord;
}
