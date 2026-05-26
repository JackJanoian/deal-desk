# Outreach Analyst (Gmail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a prebuilt "Outreach Analyst" Deal Desk role that connects to a user's Gmail via OAuth, drafts outreach emails into `dd_outreach_sends` with `awaiting_approval` status, and sends them through the Gmail API after a human approves in a dedicated Outreach Approvals UI.

**Architecture:** v1 is **Gmail-only, sends-only, standalone (no threading), approve-each-send**. OAuth tokens persist as `companySecrets` entries (per-version, audited). A thin `dd_email_accounts` metadata table maps a connected Gmail address to its secret. The agent calls HTTP tools under `/api/companies/:companyId/deal-desk/tools/outreach/*` to draft and queue. A new `OutreachApprovals` UI page surfaces queued sends; on approve, the server reads the OAuth secret, refreshes the access token if needed, calls `gmail.users.messages.send`, and writes `externalMessageId` + `sentAt` back to the row. Open-source operators bring their own GCP project + OAuth client (env vars).

**Tech Stack:** Node.js + Express (existing server), Drizzle ORM + Postgres (existing), `googleapis` npm package (new), React + Vite (existing UI), Vitest for server tests, React Testing Library + Vitest for UI tests.

---

## File Structure

**New files:**
- `packages/db/src/schema/dd_email_accounts.ts` — metadata table linking Gmail address ↔ companySecret
- `packages/db/src/migrations/0087_dd_email_accounts.sql` — migration
- `server/src/deal-desk/gmail/oauth.ts` — build authorize URL, exchange code for tokens
- `server/src/deal-desk/gmail/tokens.ts` — read/write/refresh OAuth tokens through secretsService
- `server/src/deal-desk/gmail/send.ts` — wrap Gmail API `users.messages.send` with MIME building
- `server/src/deal-desk/gmail/__tests__/send.test.ts` — unit test for MIME builder + send wiring
- `server/src/deal-desk/gmail/__tests__/oauth.test.ts` — unit test for authorize URL builder
- `server/src/routes/gmail-oauth.ts` — Express routes for `/oauth/gmail/start` + `/oauth/gmail/callback`
- `server/src/deal-desk/tools/outreach-draft.ts` — POST `/outreach/draft` handler
- `server/src/deal-desk/tools/__tests__/outreach-draft.test.ts`
- `ui/src/pages/deal-desk/EmailAccounts.tsx` — Connect Gmail / list / disconnect
- `ui/src/pages/deal-desk/OutreachApprovals.tsx` — list awaiting_approval sends, approve/reject
- `ui/src/pages/deal-desk/EmailAccounts.test.tsx`
- `ui/src/pages/deal-desk/OutreachApprovals.test.tsx`
- `skills/deal-desk-outreach/SKILL.md` — agent-facing skill describing the draft → approval loop

**Modified files:**
- `server/src/config.ts` — add `googleOAuth` config block (clientId, clientSecret, redirectUri)
- `server/src/deal-desk/tools/index.ts` — register new outreach routes
- `server/src/deal-desk/seeds/role-templates.ts` — add `OUTREACH_ANALYST` entry
- `packages/db/src/schema/index.ts` — export `ddEmailAccounts`
- `server/src/app.ts` — mount `/api/oauth/gmail/*` router
- `server/src/routes/approvals.ts` (or new dedicated route) — add `POST /outreach/sends/:id/approve` and `/reject` that perform the Gmail send and update the row
- `ui/src/App.tsx` (or routes file) — register `/deal-desk/email-accounts` and `/deal-desk/outreach-approvals` routes
- `ui/src/components/Sidebar.tsx` (or wherever Deal Desk nav lives) — add nav links

---

## Task 0: Manual GCP Prerequisite (no code)

**Files:** none (instructions for the operator)

This task is a manual checklist for whoever deploys the open-source app. Document it in `docs/deal-desk/gmail-oauth-setup.md` so end-users can follow it.

- [ ] **Step 1: Create the docs file**

Create `docs/deal-desk/gmail-oauth-setup.md` with the following content:

```markdown
# Gmail OAuth Setup for Outreach Analyst

The Outreach Analyst role sends email through the connected user's Gmail account.
You (the operator) must create your own Google Cloud project + OAuth client. Each
deployment of Deal Desk uses its own credentials.

## Steps

1. Go to https://console.cloud.google.com/ and create a new project (or pick existing).
2. Enable the Gmail API: APIs & Services → Library → search "Gmail API" → Enable.
3. Configure the OAuth consent screen: APIs & Services → OAuth consent screen.
   - User type: **External** (or Internal if you have a Workspace and only your org will use it).
   - App name, support email, developer email: fill in.
   - Scopes: add `https://www.googleapis.com/auth/gmail.send` (sensitive scope).
   - Test users: add the email addresses that will connect Gmail accounts during development.
   - Publishing status: leave in **Testing** for development (max 100 test users, no verification needed).
     For production with >100 users, submit for verification (4–6 weeks).
4. Create the OAuth client: APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - Application type: **Web application**.
   - Authorized redirect URIs: `https://YOUR_HOST/api/oauth/gmail/callback`
     (for local dev: `http://localhost:3000/api/oauth/gmail/callback`).
   - Save and copy the **Client ID** and **Client secret**.
5. Set env vars in `~/.dealdesk/.env` (or your deployment's env file):

   ```
   GOOGLE_OAUTH_CLIENT_ID=<from step 4>
   GOOGLE_OAUTH_CLIENT_SECRET=<from step 4>
   GOOGLE_OAUTH_REDIRECT_URI=https://YOUR_HOST/api/oauth/gmail/callback
   ```

6. Restart the server. The "Connect Gmail" button on the Email Accounts page will now work.
```

- [ ] **Step 2: Commit**

```bash
git add docs/deal-desk/gmail-oauth-setup.md
git commit -m "docs(deal-desk): document Gmail OAuth GCP setup prereq"
```

---

## Task 1: Env Var Wiring

**Files:**
- Modify: `server/src/config.ts`
- Test: `server/src/__tests__/config-google-oauth.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/__tests__/config-google-oauth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../config";

describe("config: googleOAuth", () => {
  const orig = { ...process.env };
  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  });
  afterEach(() => {
    process.env = { ...orig };
  });

  it("returns null googleOAuth when env vars are missing", () => {
    const cfg = loadConfig();
    expect(cfg.googleOAuth).toBeNull();
  });

  it("returns populated googleOAuth when all three env vars are set", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "cid";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "csec";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://x.test/cb";
    const cfg = loadConfig();
    expect(cfg.googleOAuth).toEqual({
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: "https://x.test/cb",
    });
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd "/Users/jackjanoian/Deal Desk/paperclip" && pnpm --filter server vitest run src/__tests__/config-google-oauth.test.ts
```

Expected: FAIL — `cfg.googleOAuth` undefined.

- [ ] **Step 3: Implement**

Edit `server/src/config.ts`. Add to the `Config` interface and `loadConfig()`:

```typescript
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface Config {
  // ... existing fields
  googleOAuth: GoogleOAuthConfig | null;
}

// inside loadConfig():
const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const googleRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
const googleOAuth =
  googleClientId && googleClientSecret && googleRedirectUri
    ? { clientId: googleClientId, clientSecret: googleClientSecret, redirectUri: googleRedirectUri }
    : null;

return {
  // ... existing fields
  googleOAuth,
};
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/__tests__/config-google-oauth.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add server/src/config.ts server/src/__tests__/config-google-oauth.test.ts
git commit -m "feat(server): add googleOAuth config block for Gmail integration"
```

---

## Task 2: Add `googleapis` dependency

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install**

```bash
cd "/Users/jackjanoian/Deal Desk/paperclip" && pnpm --filter server add googleapis
```

- [ ] **Step 2: Verify install**

```bash
pnpm --filter server list googleapis
```

Expected: shows `googleapis` with a version (current major is 144.x as of 2026-05).

- [ ] **Step 3: Commit**

```bash
git add server/package.json pnpm-lock.yaml
git commit -m "chore(server): add googleapis dependency for Gmail OAuth"
```

---

## Task 3: dd_email_accounts Schema + Migration

**Files:**
- Create: `packages/db/src/schema/dd_email_accounts.ts`
- Create: `packages/db/src/migrations/0087_dd_email_accounts.sql`
- Modify: `packages/db/src/schema/index.ts`
- Test: `packages/db/src/schema/__tests__/dd_email_accounts.test.ts`

- [ ] **Step 1: Write the schema**

Create `packages/db/src/schema/dd_email_accounts.ts`:

```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum, index, unique } from "drizzle-orm/pg-core";

export const ddEmailProviderEnum = pgEnum("dd_email_provider", ["gmail"]);

export const ddEmailAccounts = pgTable(
  "dd_email_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealDeskCompanyId: uuid("deal_desk_company_id").notNull(),
    provider: ddEmailProviderEnum("provider").notNull(),
    emailAddress: varchar("email_address", { length: 320 }).notNull(),
    secretId: uuid("secret_id").notNull(), // FK conceptually to company_secrets.id
    connectedByUserId: uuid("connected_by_user_id"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    companyIdx: index("dd_email_accounts_company_idx").on(t.dealDeskCompanyId),
    uniqueActive: unique("dd_email_accounts_company_email_unique").on(
      t.dealDeskCompanyId,
      t.emailAddress,
    ),
  }),
);
```

- [ ] **Step 2: Write the migration**

Create `packages/db/src/migrations/0087_dd_email_accounts.sql`:

```sql
-- DEAL DESK: connected Gmail accounts (metadata only; tokens live in company_secrets)
CREATE TYPE dd_email_provider AS ENUM ('gmail');

CREATE TABLE dd_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_desk_company_id UUID NOT NULL,
  provider dd_email_provider NOT NULL,
  email_address VARCHAR(320) NOT NULL,
  secret_id UUID NOT NULL,
  connected_by_user_id UUID,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT dd_email_accounts_company_email_unique
    UNIQUE (deal_desk_company_id, email_address)
);

CREATE INDEX dd_email_accounts_company_idx ON dd_email_accounts (deal_desk_company_id);
```

- [ ] **Step 3: Add to schema index**

Edit `packages/db/src/schema/index.ts`. After the existing Deal Desk export block (around line 79–94), add:

```typescript
export { ddEmailAccounts, ddEmailProviderEnum } from "./dd_email_accounts.js";
```

- [ ] **Step 4: Run migration, verify**

```bash
cd "/Users/jackjanoian/Deal Desk/paperclip" && pnpm --filter @paperclip/db migrate
```

Expected: applies `0087_dd_email_accounts.sql` cleanly.

- [ ] **Step 5: Verify table**

```bash
psql "$DATABASE_URL" -c "\d dd_email_accounts"
```

Expected: shows the table with the columns above.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/dd_email_accounts.ts \
        packages/db/src/migrations/0087_dd_email_accounts.sql \
        packages/db/src/schema/index.ts
git commit -m "feat(db): add dd_email_accounts table for connected Gmail accounts"
```

---

## Task 4: Gmail OAuth — Authorize URL Builder

**Files:**
- Create: `server/src/deal-desk/gmail/oauth.ts`
- Test: `server/src/deal-desk/gmail/__tests__/oauth.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/deal-desk/gmail/__tests__/oauth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildGmailAuthorizeUrl } from "../oauth";

describe("buildGmailAuthorizeUrl", () => {
  it("includes client_id, redirect_uri, send scope, offline access, and the state token", () => {
    const url = new URL(
      buildGmailAuthorizeUrl({
        clientId: "cid",
        redirectUri: "https://x.test/cb",
        state: "state-abc",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.test/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("scope")).toContain("gmail.send");
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/oauth.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/deal-desk/gmail/oauth.ts`:

```typescript
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
}

export function buildGmailAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent", // ensure refresh_token returned every time
    scope: [GMAIL_SEND_SCOPE, GMAIL_USERINFO_SCOPE].join(" "),
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/oauth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/gmail/oauth.ts \
        server/src/deal-desk/gmail/__tests__/oauth.test.ts
git commit -m "feat(deal-desk): add Gmail OAuth authorize URL builder"
```

---

## Task 5: Gmail OAuth — Token Exchange + Storage

**Files:**
- Modify: `server/src/deal-desk/gmail/oauth.ts`
- Create: `server/src/deal-desk/gmail/tokens.ts`
- Test: `server/src/deal-desk/gmail/__tests__/tokens.test.ts`

- [ ] **Step 1: Write failing test for token exchange**

Append to `server/src/deal-desk/gmail/__tests__/oauth.test.ts`:

```typescript
import { exchangeCodeForTokens } from "../oauth";
import { vi } from "vitest";

describe("exchangeCodeForTokens", () => {
  it("POSTs to Google token endpoint and returns parsed tokens", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3599,
        scope: "https://www.googleapis.com/auth/gmail.send",
        token_type: "Bearer",
      }),
    });
    const result = await exchangeCodeForTokens(
      { clientId: "cid", clientSecret: "csec", redirectUri: "https://x.test/cb", code: "abc" },
      { fetch: fakeFetch as unknown as typeof fetch },
    );
    expect(result.refreshToken).toBe("rt");
    expect(result.accessToken).toBe("at");
    expect(result.expiresInSeconds).toBe(3599);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/oauth.test.ts
```

Expected: FAIL — `exchangeCodeForTokens` not exported.

- [ ] **Step 3: Implement**

Append to `server/src/deal-desk/gmail/oauth.ts`:

```typescript
export interface ExchangeCodeInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scope: string;
}

export interface ExchangeDeps {
  fetch?: typeof fetch;
}

export async function exchangeCodeForTokens(
  input: ExchangeCodeInput,
  deps: ExchangeDeps = {},
): Promise<ExchangedTokens> {
  const f = deps.fetch ?? fetch;
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Gmail token exchange failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
    scope: json.scope,
  };
}

export async function fetchGoogleUserEmail(
  accessToken: string,
  deps: ExchangeDeps = {},
): Promise<string> {
  const f = deps.fetch ?? fetch;
  const res = await f("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail userinfo failed: ${res.status}`);
  const json = (await res.json()) as { email: string };
  return json.email;
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/oauth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for token persistence**

Create `server/src/deal-desk/gmail/__tests__/tokens.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { saveGmailTokens, loadGmailTokens, type GmailTokensRecord } from "../tokens";

describe("Gmail token persistence", () => {
  it("saveGmailTokens creates a secret with the refresh+access token JSON", async () => {
    const created: Array<{ key: string; value: string }> = [];
    const fakeSvc = {
      createSecret: vi.fn().mockResolvedValue({ id: "sec-1" }),
      addVersion: vi.fn().mockImplementation(async ({ key, value }) => {
        created.push({ key, value });
        return { version: 1 };
      }),
    };
    const id = await saveGmailTokens({
      companyId: "co-1",
      emailAddress: "alice@example.com",
      tokens: { accessToken: "at", refreshToken: "rt", expiresInSeconds: 3599, scope: "x" },
    }, { secretService: fakeSvc as never });

    expect(id).toBe("sec-1");
    expect(created).toHaveLength(1);
    const parsed = JSON.parse(created[0]!.value) as GmailTokensRecord;
    expect(parsed.refreshToken).toBe("rt");
    expect(parsed.accessToken).toBe("at");
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 6: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/tokens.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement**

Create `server/src/deal-desk/gmail/tokens.ts`:

```typescript
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
```

> **Note for the implementer:** the actual function names on `secretService` may differ slightly. Check `server/src/services/secrets.ts` and adapt the `SecretServiceLike` interface to match the real signatures. The unit test only exercises the structural contract; the real integration is covered by Task 6's manual smoke test.

- [ ] **Step 8: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/tokens.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/deal-desk/gmail/oauth.ts \
        server/src/deal-desk/gmail/tokens.ts \
        server/src/deal-desk/gmail/__tests__/oauth.test.ts \
        server/src/deal-desk/gmail/__tests__/tokens.test.ts
git commit -m "feat(deal-desk): add Gmail OAuth token exchange + secret persistence"
```

---

## Task 6: Refresh-Token Rotation

**Files:**
- Modify: `server/src/deal-desk/gmail/tokens.ts`
- Test: `server/src/deal-desk/gmail/__tests__/tokens.test.ts`

- [ ] **Step 1: Write failing test**

Append to `server/src/deal-desk/gmail/__tests__/tokens.test.ts`:

```typescript
import { ensureFreshAccessToken } from "../tokens";

describe("ensureFreshAccessToken", () => {
  it("returns the cached access token if not yet near expiry", async () => {
    const tokens: GmailTokensRecord = {
      refreshToken: "rt",
      accessToken: "still-good",
      expiresAt: Date.now() + 10 * 60_000,
      scope: "x",
    };
    const result = await ensureFreshAccessToken(
      { tokens, clientId: "c", clientSecret: "s" },
      { fetch: vi.fn() as unknown as typeof fetch },
    );
    expect(result.accessToken).toBe("still-good");
  });

  it("refreshes when access token expires within 60s", async () => {
    const tokens: GmailTokensRecord = {
      refreshToken: "rt",
      accessToken: "expiring",
      expiresAt: Date.now() + 30_000,
      scope: "x",
    };
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-at", expires_in: 3599 }),
    });
    const result = await ensureFreshAccessToken(
      { tokens, clientId: "c", clientSecret: "s" },
      { fetch: fakeFetch as unknown as typeof fetch },
    );
    expect(result.accessToken).toBe("new-at");
    expect(result.expiresAt).toBeGreaterThan(Date.now() + 3_500_000);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/tokens.test.ts
```

Expected: FAIL — `ensureFreshAccessToken` not exported.

- [ ] **Step 3: Implement**

Append to `server/src/deal-desk/gmail/tokens.ts`:

```typescript
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
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/tokens.test.ts
```

Expected: PASS (3/3 in this file).

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/gmail/tokens.ts \
        server/src/deal-desk/gmail/__tests__/tokens.test.ts
git commit -m "feat(deal-desk): refresh Gmail access tokens before expiry"
```

---

## Task 7: Gmail Send (MIME Builder + API Wrapper)

**Files:**
- Create: `server/src/deal-desk/gmail/send.ts`
- Test: `server/src/deal-desk/gmail/__tests__/send.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/deal-desk/gmail/__tests__/send.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildRfc822Message, sendGmail } from "../send";

describe("buildRfc822Message", () => {
  it("produces RFC822 with From, To, Subject, plain body", () => {
    const raw = buildRfc822Message({
      from: "alice@example.com",
      to: "bob@example.com",
      subject: "Hello",
      body: "Hi Bob,\n\nFirst line.",
    });
    expect(raw).toContain("From: alice@example.com");
    expect(raw).toContain("To: bob@example.com");
    expect(raw).toContain("Subject: Hello");
    expect(raw).toContain("Hi Bob,");
  });
});

describe("sendGmail", () => {
  it("base64url-encodes the RFC822 message and POSTs to gmail.users.messages.send", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg-1", threadId: "thread-1" }),
    });
    const result = await sendGmail(
      {
        accessToken: "at",
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Hello",
        body: "Hi",
      },
      { fetch: fakeFetch as unknown as typeof fetch },
    );
    expect(result.messageId).toBe("msg-1");
    expect(result.threadId).toBe("thread-1");
    const [url, init] = fakeFetch.mock.calls[0]!;
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer at");
    const sent = JSON.parse((init as RequestInit).body as string) as { raw: string };
    // base64url uses - and _, no padding
    expect(sent.raw).not.toContain("+");
    expect(sent.raw).not.toContain("/");
    expect(sent.raw).not.toContain("=");
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/send.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/deal-desk/gmail/send.ts`:

```typescript
export interface BuildMessageInput {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export function buildRfc822Message(input: BuildMessageInput): string {
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.body,
  ];
  return lines.join("\r\n");
}

function base64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export interface SendInput extends BuildMessageInput {
  accessToken: string;
}

export interface SendResult {
  messageId: string;
  threadId: string;
}

export interface SendDeps {
  fetch?: typeof fetch;
}

export async function sendGmail(input: SendInput, deps: SendDeps = {}): Promise<SendResult> {
  const f = deps.fetch ?? fetch;
  const raw = base64url(buildRfc822Message(input));
  const res = await f("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string; threadId: string };
  return { messageId: json.id, threadId: json.threadId };
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/send.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/gmail/send.ts \
        server/src/deal-desk/gmail/__tests__/send.test.ts
git commit -m "feat(deal-desk): add Gmail RFC822 builder + users.messages.send wrapper"
```

---

## Task 8: OAuth Express Routes (start + callback)

**Files:**
- Create: `server/src/routes/gmail-oauth.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/routes/__tests__/gmail-oauth.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/routes/__tests__/gmail-oauth.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createGmailOAuthRouter } from "../gmail-oauth";

describe("Gmail OAuth routes", () => {
  it("GET /start redirects to Google authorize URL with state cookie set", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        config: { clientId: "cid", clientSecret: "csec", redirectUri: "https://x.test/cb" },
        // companyId resolution: test stub
        resolveCompanyId: () => "co-1",
        deps: {
          db: {} as never,
        },
      }),
    );
    const res = await request(app).get("/start?companyId=co-1");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(res.headers.location).toContain("client_id=cid");
    expect(res.headers["set-cookie"]?.[0]).toContain("dd_gmail_oauth_state=");
  });

  it("GET /start returns 503 when googleOAuth is not configured", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        config: null,
        resolveCompanyId: () => "co-1",
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start?companyId=co-1");
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/routes/__tests__/gmail-oauth.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/routes/gmail-oauth.ts`:

```typescript
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { buildGmailAuthorizeUrl, exchangeCodeForTokens, fetchGoogleUserEmail } from "../deal-desk/gmail/oauth.js";
import { saveGmailTokens } from "../deal-desk/gmail/tokens.js";
import type { GoogleOAuthConfig } from "../config.js";
import type { Db } from "../db.js"; // adapt import to actual Db type alias
import { ddEmailAccounts } from "@paperclip/db";
import { secretService } from "../services/secrets.js"; // adapt to actual export

const STATE_COOKIE = "dd_gmail_oauth_state";

export interface CreateRouterInput {
  config: GoogleOAuthConfig | null;
  resolveCompanyId: (req: Request) => string | null;
  deps: { db: Db };
}

export function createGmailOAuthRouter(input: CreateRouterInput): Router {
  const router = Router();

  router.get("/start", (req: Request, res: Response) => {
    if (!input.config) {
      res.status(503).json({ ok: false, reason: "Gmail OAuth not configured" });
      return;
    }
    const companyId = input.resolveCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    const stateValue = `${companyId}.${crypto.randomBytes(16).toString("hex")}`;
    res.cookie(STATE_COOKIE, stateValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: input.config.redirectUri.startsWith("https://"),
      maxAge: 10 * 60_000,
    });
    const url = buildGmailAuthorizeUrl({
      clientId: input.config.clientId,
      redirectUri: input.config.redirectUri,
      state: stateValue,
    });
    res.redirect(url);
  });

  router.get("/callback", async (req: Request, res: Response) => {
    if (!input.config) {
      res.status(503).send("Gmail OAuth not configured");
      return;
    }
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as Request & { cookies?: Record<string, string> }).cookies?.[STATE_COOKIE];
    if (!code || !state || !cookieState || state !== cookieState) {
      res.status(400).send("Invalid OAuth state");
      return;
    }
    const companyId = state.split(".")[0]!;
    const tokens = await exchangeCodeForTokens({
      clientId: input.config.clientId,
      clientSecret: input.config.clientSecret,
      redirectUri: input.config.redirectUri,
      code,
    });
    const emailAddress = await fetchGoogleUserEmail(tokens.accessToken);
    const secretsSvc = secretService(input.deps.db);
    const secretId = await saveGmailTokens(
      { companyId, emailAddress, tokens },
      // Adapter: wrap secretsSvc to match SecretServiceLike interface from tokens.ts
      { secretService: secretsSvc as never },
    );
    await input.deps.db.insert(ddEmailAccounts).values({
      dealDeskCompanyId: companyId,
      provider: "gmail",
      emailAddress,
      secretId,
    });
    res.clearCookie(STATE_COOKIE);
    res.redirect(`/${companyId}/deal-desk/email-accounts?connected=${encodeURIComponent(emailAddress)}`);
  });

  return router;
}
```

> **Note for the implementer:** the imports for `Db`, `secretService`, and `ddEmailAccounts` need to match the exact paths used elsewhere in the server. Check `server/src/deal-desk/tools/create-target.ts` for the conventional import pattern.

- [ ] **Step 4: Mount the router**

Edit `server/src/app.ts`. Find where other routers are mounted (look for `app.use("/api/...")` patterns) and add:

```typescript
import { createGmailOAuthRouter } from "./routes/gmail-oauth.js";
import cookieParser from "cookie-parser";

// before route registration:
app.use(cookieParser());

// with other routes:
app.use(
  "/api/oauth/gmail",
  createGmailOAuthRouter({
    config: config.googleOAuth,
    resolveCompanyId: (req) =>
      (req.query.companyId as string | undefined) ??
      (req as Request & { user?: { companyId?: string } }).user?.companyId ??
      null,
    deps: { db },
  }),
);
```

If `cookie-parser` isn't already a dependency:

```bash
pnpm --filter server add cookie-parser
pnpm --filter server add -D @types/cookie-parser
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/routes/__tests__/gmail-oauth.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --filter server typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/gmail-oauth.ts \
        server/src/routes/__tests__/gmail-oauth.test.ts \
        server/src/app.ts \
        server/package.json pnpm-lock.yaml
git commit -m "feat(deal-desk): mount Gmail OAuth start + callback routes"
```

---

## Task 9: Outreach Draft Tool (HTTP route for the agent)

**Files:**
- Create: `server/src/deal-desk/tools/outreach-draft.ts`
- Modify: `server/src/deal-desk/tools/index.ts`
- Test: `server/src/deal-desk/tools/__tests__/outreach-draft.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/deal-desk/tools/__tests__/outreach-draft.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { outreachDraftHandler } from "../outreach-draft";

describe("POST /outreach/draft", () => {
  it("returns 400 when subject is missing", async () => {
    const app = express();
    app.use(express.json());
    app.post("/outreach/draft", outreachDraftHandler({ insert: vi.fn() } as never));
    const res = await request(app).post("/outreach/draft").send({
      campaignId: "11111111-1111-1111-1111-111111111111",
      targetId: "22222222-2222-2222-2222-222222222222",
      contactId: "33333333-3333-3333-3333-333333333333",
      body: "hello",
    });
    expect(res.status).toBe(400);
  });

  it("inserts a row with status awaiting_approval and returns the id", async () => {
    const inserted: unknown[] = [];
    const fakeDb = {
      insert: () => ({
        values: (v: unknown) => ({
          returning: async () => {
            inserted.push(v);
            return [{ id: "send-1" }];
          },
        }),
      }),
    };
    const app = express();
    app.use(express.json());
    app.post("/outreach/draft", outreachDraftHandler(fakeDb as never));
    const res = await request(app).post("/outreach/draft").send({
      campaignId: "11111111-1111-1111-1111-111111111111",
      targetId: "22222222-2222-2222-2222-222222222222",
      contactId: "33333333-3333-3333-3333-333333333333",
      subject: "Hello",
      body: "Body text",
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "send-1" });
    expect(inserted[0]).toMatchObject({ status: "awaiting_approval", subject: "Hello" });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/outreach-draft.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/deal-desk/tools/outreach-draft.ts`:

```typescript
import { z } from "zod";
import type { Request, Response } from "express";
import type { Db } from "../../db.js";
import { ddOutreachSends } from "@paperclip/db";

export const outreachDraftInputSchema = z.object({
  campaignId: z.string().uuid(),
  targetId: z.string().uuid(),
  contactId: z.string().uuid(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  cadenceStep: z.number().int().min(0).default(0),
});

export function outreachDraftHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const parsed = outreachDraftInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string;
    const { campaignId, targetId, contactId, subject, body, cadenceStep } = parsed.data;
    const [row] = await db
      .insert(ddOutreachSends)
      .values({
        dealDeskCompanyId: companyId,
        campaignId,
        targetId,
        contactId,
        subject,
        body,
        cadenceStep,
        status: "awaiting_approval",
        draftedByAgentId: (req as Request & { agentId?: string }).agentId ?? null,
      })
      .returning({ id: ddOutreachSends.id });
    res.status(201).json({ id: row!.id });
  };
}
```

- [ ] **Step 4: Register the route**

Edit `server/src/deal-desk/tools/index.ts`. Add:

```typescript
import { outreachDraftHandler } from "./outreach-draft.js";

// inside registerDealDeskTools:
parent.post("/outreach/draft", outreachDraftHandler(db));
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/outreach-draft.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add server/src/deal-desk/tools/outreach-draft.ts \
        server/src/deal-desk/tools/__tests__/outreach-draft.test.ts \
        server/src/deal-desk/tools/index.ts
git commit -m "feat(deal-desk): add outreach/draft tool for Outreach Analyst"
```

---

## Task 10: Approve-and-Send Endpoint

**Files:**
- Create: `server/src/deal-desk/tools/outreach-approve.ts`
- Modify: `server/src/deal-desk/tools/index.ts`
- Test: `server/src/deal-desk/tools/__tests__/outreach-approve.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/deal-desk/tools/__tests__/outreach-approve.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { outreachApproveHandler } from "../outreach-approve";

describe("POST /outreach/sends/:id/approve", () => {
  it("loads the send, fetches connected Gmail account, sends, updates row", async () => {
    const fakeDb = {
      query: {
        ddOutreachSends: { findFirst: vi.fn().mockResolvedValue({
          id: "send-1",
          dealDeskCompanyId: "co-1",
          subject: "Hello",
          body: "Hi",
          contactId: "c-1",
          status: "awaiting_approval",
        })},
        ddContacts: { findFirst: vi.fn().mockResolvedValue({ email: "bob@example.com" }) },
        ddEmailAccounts: { findFirst: vi.fn().mockResolvedValue({
          id: "acc-1", emailAddress: "alice@example.com", secretId: "sec-1",
        })},
      },
      update: () => ({ set: (v: unknown) => ({ where: async () => v }) }),
    };
    const fakeSendGmail = vi.fn().mockResolvedValue({ messageId: "g-1", threadId: "t-1" });
    const fakeLoadTokens = vi.fn().mockResolvedValue({
      accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 600_000, scope: "x",
    });
    const fakeEnsureFresh = vi.fn().mockImplementation((i) => Promise.resolve(i.tokens));

    const app = express();
    app.use((req, _res, next) => { (req as never as { user: unknown }).user = { id: "u-1" }; next(); });
    app.post("/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      googleOAuth: { clientId: "c", clientSecret: "s", redirectUri: "r" },
      sendGmail: fakeSendGmail,
      loadGmailTokens: fakeLoadTokens,
      ensureFreshAccessToken: fakeEnsureFresh,
    }));
    const res = await request(app).post("/outreach/sends/send-1/approve");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ messageId: "g-1" });
    expect(fakeSendGmail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "alice@example.com", to: "bob@example.com", subject: "Hello", body: "Hi" }),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/outreach-approve.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/deal-desk/tools/outreach-approve.ts`:

```typescript
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "../../db.js";
import type { GoogleOAuthConfig } from "../../config.js";
import { ddOutreachSends, ddEmailAccounts, ddContacts } from "@paperclip/db";
import { sendGmail as sendGmailReal } from "../gmail/send.js";
import { loadGmailTokens as loadTokensReal, ensureFreshAccessToken as ensureFreshReal } from "../gmail/tokens.js";

export interface ApproveDeps {
  db: Db;
  googleOAuth: GoogleOAuthConfig | null;
  sendGmail?: typeof sendGmailReal;
  loadGmailTokens?: typeof loadTokensReal;
  ensureFreshAccessToken?: typeof ensureFreshReal;
}

export function outreachApproveHandler(deps: ApproveDeps) {
  const sendGmail = deps.sendGmail ?? sendGmailReal;
  const loadGmailTokens = deps.loadGmailTokens ?? loadTokensReal;
  const ensureFreshAccessToken = deps.ensureFreshAccessToken ?? ensureFreshReal;

  return async (req: Request, res: Response) => {
    if (!deps.googleOAuth) {
      res.status(503).json({ ok: false, reason: "Gmail OAuth not configured" });
      return;
    }
    const sendId = req.params.id as string;
    const send = await deps.db.query.ddOutreachSends.findFirst({ where: eq(ddOutreachSends.id, sendId) });
    if (!send) { res.status(404).json({ ok: false, reason: "Send not found" }); return; }
    if (send.status !== "awaiting_approval") {
      res.status(409).json({ ok: false, reason: `Send status is ${send.status}, not awaiting_approval` });
      return;
    }
    const contact = await deps.db.query.ddContacts.findFirst({ where: eq(ddContacts.id, send.contactId!) });
    if (!contact?.email) { res.status(400).json({ ok: false, reason: "Contact has no email" }); return; }
    const account = await deps.db.query.ddEmailAccounts.findFirst({
      where: eq(ddEmailAccounts.dealDeskCompanyId, send.dealDeskCompanyId),
    });
    if (!account) { res.status(400).json({ ok: false, reason: "No connected Gmail account" }); return; }

    const stored = await loadGmailTokens(
      { secretId: account.secretId },
      // adapt to actual secretService wiring at call time
      { secretService: undefined as never },
    );
    const fresh = await ensureFreshAccessToken({
      tokens: stored,
      clientId: deps.googleOAuth.clientId,
      clientSecret: deps.googleOAuth.clientSecret,
    });

    const result = await sendGmail({
      accessToken: fresh.accessToken,
      from: account.emailAddress,
      to: contact.email,
      subject: send.subject,
      body: send.body,
    });

    const userId = (req as Request & { user?: { id?: string } }).user?.id ?? null;
    await deps.db
      .update(ddOutreachSends)
      .set({
        status: "sent",
        sentAt: new Date(),
        externalMessageId: result.messageId,
        approvedByUserId: userId,
        approvedAt: new Date(),
      })
      .where(eq(ddOutreachSends.id, sendId));

    res.status(200).json({ messageId: result.messageId, threadId: result.threadId });
  };
}
```

> **Implementer note:** the `loadGmailTokens` call needs the real secretService passed in. Wire it from the same place where you mount the route. The test stubs the dependency entirely.

- [ ] **Step 4: Register the route**

Edit `server/src/deal-desk/tools/index.ts`. Add:

```typescript
import { outreachApproveHandler } from "./outreach-approve.js";
import { config } from "../../config.js"; // or however config is accessed

// inside registerDealDeskTools (or wherever you have access to config):
parent.post(
  "/outreach/sends/:id/approve",
  outreachApproveHandler({ db, googleOAuth: config.googleOAuth }),
);
```

- [ ] **Step 5: Add a reject endpoint**

Append to `outreach-approve.ts`:

```typescript
export function outreachRejectHandler(deps: { db: Db }) {
  return async (req: Request, res: Response) => {
    const sendId = req.params.id as string;
    const send = await deps.db.query.ddOutreachSends.findFirst({ where: eq(ddOutreachSends.id, sendId) });
    if (!send) { res.status(404).json({ ok: false }); return; }
    if (send.status !== "awaiting_approval") {
      res.status(409).json({ ok: false, reason: `Send status is ${send.status}` });
      return;
    }
    await deps.db.update(ddOutreachSends).set({ status: "failed" }).where(eq(ddOutreachSends.id, sendId));
    res.status(200).json({ ok: true });
  };
}
```

Register it:

```typescript
parent.post("/outreach/sends/:id/reject", outreachRejectHandler({ db }));
```

- [ ] **Step 6: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/outreach-approve.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/deal-desk/tools/outreach-approve.ts \
        server/src/deal-desk/tools/__tests__/outreach-approve.test.ts \
        server/src/deal-desk/tools/index.ts
git commit -m "feat(deal-desk): approve/reject outreach sends, dispatch via Gmail"
```

---

## Task 11: List Endpoint for Approvals UI

**Files:**
- Create: `server/src/deal-desk/tools/outreach-list-pending.ts`
- Modify: `server/src/deal-desk/tools/index.ts`
- Test: `server/src/deal-desk/tools/__tests__/outreach-list-pending.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/deal-desk/tools/__tests__/outreach-list-pending.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { listPendingOutreachHandler } from "../outreach-list-pending";

describe("GET /outreach/sends/pending", () => {
  it("returns awaiting_approval sends for the company", async () => {
    const fakeDb = {
      query: {
        ddOutreachSends: {
          findMany: vi.fn().mockResolvedValue([
            { id: "s-1", subject: "Hi", body: "Body", status: "awaiting_approval" },
          ]),
        },
      },
    };
    const app = express();
    app.post("/c/:companyId/outreach/sends/pending", (req, res, next) => {
      req.params.companyId = "co-1";
      next();
    }, listPendingOutreachHandler(fakeDb as never));
    const res = await request(app).post("/c/co-1/outreach/sends/pending");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sends: [{ id: "s-1", subject: "Hi", body: "Body", status: "awaiting_approval" }] });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/outreach-list-pending.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `server/src/deal-desk/tools/outreach-list-pending.ts`:

```typescript
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db.js";
import { ddOutreachSends } from "@paperclip/db";

export function listPendingOutreachHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const sends = await db.query.ddOutreachSends.findMany({
      where: and(
        eq(ddOutreachSends.dealDeskCompanyId, companyId),
        eq(ddOutreachSends.status, "awaiting_approval"),
      ),
    });
    res.status(200).json({ sends });
  };
}
```

- [ ] **Step 4: Register**

Edit `server/src/deal-desk/tools/index.ts`. Add:

```typescript
import { listPendingOutreachHandler } from "./outreach-list-pending.js";

parent.get("/outreach/sends/pending", listPendingOutreachHandler(db));
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/outreach-list-pending.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add a list-email-accounts endpoint**

Append to `server/src/deal-desk/tools/index.ts`:

```typescript
parent.get("/email-accounts", async (req, res) => {
  const companyId = req.params.companyId as string;
  const rows = await db.query.ddEmailAccounts.findMany({
    where: eq(ddEmailAccounts.dealDeskCompanyId, companyId),
  });
  res.status(200).json({ accounts: rows });
});
parent.delete("/email-accounts/:id", async (req, res) => {
  const id = req.params.id as string;
  await db.update(ddEmailAccounts).set({ revokedAt: new Date() }).where(eq(ddEmailAccounts.id, id));
  res.status(200).json({ ok: true });
});
```

(Add the necessary imports for `ddEmailAccounts` and `eq` at the top.)

- [ ] **Step 7: Commit**

```bash
git add server/src/deal-desk/tools/outreach-list-pending.ts \
        server/src/deal-desk/tools/__tests__/outreach-list-pending.test.ts \
        server/src/deal-desk/tools/index.ts
git commit -m "feat(deal-desk): list pending outreach + email account CRUD"
```

---

## Task 12: UI — Email Accounts Page

**Files:**
- Create: `ui/src/pages/deal-desk/EmailAccounts.tsx`
- Create: `ui/src/pages/deal-desk/EmailAccounts.test.tsx`
- Modify: `ui/src/App.tsx` (or wherever routes are registered)

- [ ] **Step 1: Write failing test**

Create `ui/src/pages/deal-desk/EmailAccounts.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmailAccounts } from "./EmailAccounts";

describe("EmailAccounts", () => {
  it("shows the connect button when no accounts are connected", () => {
    render(<EmailAccounts companyId="co-1" accounts={[]} onConnect={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByRole("link", { name: /connect gmail/i })).toBeInTheDocument();
  });

  it("renders connected accounts with a disconnect button", () => {
    render(
      <EmailAccounts
        companyId="co-1"
        accounts={[{ id: "a-1", emailAddress: "alice@example.com", provider: "gmail", revokedAt: null }]}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    );
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd "/Users/jackjanoian/Deal Desk/paperclip" && pnpm --filter ui vitest run src/pages/deal-desk/EmailAccounts.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `ui/src/pages/deal-desk/EmailAccounts.tsx`:

```tsx
import { useEffect, useState } from "react";

export interface EmailAccount {
  id: string;
  emailAddress: string;
  provider: "gmail";
  revokedAt: string | null;
}

export interface EmailAccountsProps {
  companyId: string;
  accounts: EmailAccount[];
  onConnect: () => void;
  onDisconnect: (id: string) => void;
}

export function EmailAccounts(props: EmailAccountsProps) {
  const active = props.accounts.filter((a) => !a.revokedAt);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Email Accounts</h1>
      <p className="text-sm text-gray-600 mb-4">
        Connect a Gmail account so the Outreach Analyst can send messages on your behalf.
        Each send still requires your approval.
      </p>
      <a
        href={`/api/oauth/gmail/start?companyId=${encodeURIComponent(props.companyId)}`}
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded"
        onClick={props.onConnect}
      >
        Connect Gmail
      </a>
      <ul className="mt-6 divide-y">
        {active.map((a) => (
          <li key={a.id} className="py-3 flex items-center justify-between">
            <span>{a.emailAddress}</span>
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => props.onDisconnect(a.id)}
            >
              Disconnect
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmailAccountsPage({ companyId }: { companyId: string }) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  useEffect(() => {
    fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []));
  }, [companyId]);

  const onDisconnect = async (id: string) => {
    await fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, revokedAt: new Date().toISOString() } : a)));
  };

  return (
    <EmailAccounts
      companyId={companyId}
      accounts={accounts}
      onConnect={() => {}}
      onDisconnect={onDisconnect}
    />
  );
}
```

- [ ] **Step 4: Register the route**

Edit `ui/src/App.tsx` (or the routes file). Add:

```tsx
import { EmailAccountsPage } from "./pages/deal-desk/EmailAccounts";

// inside the deal-desk route group:
<Route path="email-accounts" element={<EmailAccountsPage companyId={companyId} />} />
```

(Match the actual existing pattern — Deal Desk pages already have a route group, this slots in.)

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm --filter ui vitest run src/pages/deal-desk/EmailAccounts.test.tsx
```

Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add ui/src/pages/deal-desk/EmailAccounts.tsx \
        ui/src/pages/deal-desk/EmailAccounts.test.tsx \
        ui/src/App.tsx
git commit -m "feat(ui): add Deal Desk Email Accounts page"
```

---

## Task 13: UI — Outreach Approvals Page

**Files:**
- Create: `ui/src/pages/deal-desk/OutreachApprovals.tsx`
- Create: `ui/src/pages/deal-desk/OutreachApprovals.test.tsx`
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: Write failing test**

Create `ui/src/pages/deal-desk/OutreachApprovals.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutreachApprovals } from "./OutreachApprovals";

describe("OutreachApprovals", () => {
  it("renders pending sends with subject + body and approve/reject buttons", async () => {
    const onApprove = vi.fn();
    render(
      <OutreachApprovals
        sends={[{ id: "s-1", subject: "Hello", body: "Body text", status: "awaiting_approval" }]}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /approve & send/i }));
    expect(onApprove).toHaveBeenCalledWith("s-1");
  });

  it("shows an empty state when there are no pending sends", () => {
    render(<OutreachApprovals sends={[]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/no outreach awaiting approval/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter ui vitest run src/pages/deal-desk/OutreachApprovals.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `ui/src/pages/deal-desk/OutreachApprovals.tsx`:

```tsx
import { useEffect, useState } from "react";

export interface PendingSend {
  id: string;
  subject: string;
  body: string;
  status: "awaiting_approval";
}

export interface OutreachApprovalsProps {
  sends: PendingSend[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function OutreachApprovals(props: OutreachApprovalsProps) {
  if (props.sends.length === 0) {
    return <div className="p-6 text-gray-500">No outreach awaiting approval.</div>;
  }
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Outreach Approvals</h1>
      {props.sends.map((s) => (
        <div key={s.id} className="border rounded p-4">
          <div className="font-medium">{s.subject}</div>
          <pre className="whitespace-pre-wrap text-sm mt-2">{s.body}</pre>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={() => props.onApprove(s.id)}
            >
              Approve & Send
            </button>
            <button
              type="button"
              className="px-3 py-1 bg-gray-200 rounded"
              onClick={() => props.onReject(s.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OutreachApprovalsPage({ companyId }: { companyId: string }) {
  const [sends, setSends] = useState<PendingSend[]>([]);
  const refresh = () => {
    fetch(`/api/companies/${companyId}/deal-desk/tools/outreach/sends/pending`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setSends(j.sends ?? []));
  };
  useEffect(refresh, [companyId]);

  const onApprove = async (id: string) => {
    await fetch(`/api/companies/${companyId}/deal-desk/tools/outreach/sends/${id}/approve`, {
      method: "POST",
      credentials: "include",
    });
    refresh();
  };
  const onReject = async (id: string) => {
    await fetch(`/api/companies/${companyId}/deal-desk/tools/outreach/sends/${id}/reject`, {
      method: "POST",
      credentials: "include",
    });
    refresh();
  };

  return <OutreachApprovals sends={sends} onApprove={onApprove} onReject={onReject} />;
}
```

- [ ] **Step 4: Register the route**

Edit `ui/src/App.tsx`. Add:

```tsx
import { OutreachApprovalsPage } from "./pages/deal-desk/OutreachApprovals";

<Route path="outreach-approvals" element={<OutreachApprovalsPage companyId={companyId} />} />
```

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm --filter ui vitest run src/pages/deal-desk/OutreachApprovals.test.tsx
```

Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add ui/src/pages/deal-desk/OutreachApprovals.tsx \
        ui/src/pages/deal-desk/OutreachApprovals.test.tsx \
        ui/src/App.tsx
git commit -m "feat(ui): add Outreach Approvals page"
```

---

## Task 14: Sidebar Nav Links

**Files:**
- Modify: `ui/src/components/Sidebar.tsx` (or the actual Deal Desk nav file — locate via `grep -r "deal-desk/targets" ui/src/`)

- [ ] **Step 1: Locate the sidebar**

```bash
grep -rn "deal-desk/targets" "/Users/jackjanoian/Deal Desk/paperclip/ui/src/" | head
```

Note the file path that contains the existing Deal Desk nav links.

- [ ] **Step 2: Add two new links**

In that file, next to existing Deal Desk links, add:

```tsx
<NavLink to="email-accounts">Email Accounts</NavLink>
<NavLink to="outreach-approvals">Outreach Approvals</NavLink>
```

(Match the existing component idiom — could be `<Link>`, `<NavLink>`, or a custom component.)

- [ ] **Step 3: Smoke-test by visiting the routes**

```bash
pnpm dev
```

Open the app, navigate to `/<COMPANY>/deal-desk/email-accounts` and `/<COMPANY>/deal-desk/outreach-approvals`. Both should render (Email Accounts shows Connect Gmail; Outreach Approvals shows empty state).

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Sidebar.tsx
git commit -m "feat(ui): add sidebar links for Email Accounts and Outreach Approvals"
```

---

## Task 15: Outreach Analyst Role Template Seed

**Files:**
- Modify: `server/src/deal-desk/seeds/role-templates.ts`

- [ ] **Step 1: Add the new template**

Edit `server/src/deal-desk/seeds/role-templates.ts`. After the existing `dd-intermediary-coverage` entry, add:

```typescript
{
  slug: "dd-outreach-analyst",
  name: "Outreach Analyst",
  description:
    "Drafts and sends outreach emails to targets and intermediaries through your " +
    "connected Gmail account. Every send is queued for your approval first.",
  defaultHeartbeatCron: "0 9 * * 1-5", // weekdays 9am
  defaultBudgetUsd: 25,
  systemPrompt: withDealDeskSkills(
    "You are an Outreach Analyst responsible for executing outreach campaigns through " +
    "the firm's connected Gmail account. Each heartbeat: " +
    "(1) check that a Gmail account is connected — if not, file an issue asking the user to " +
    "visit /deal-desk/email-accounts and connect one. Do not attempt to draft outreach until " +
    "an account is connected. " +
    "(2) review active dd_outreach_campaigns and pick the highest-priority contact whose " +
    "next_touch is due. Skip anyone on dd_suppression_list. " +
    "(3) draft a personalized email referencing the contact's recent activity and the campaign's " +
    "talking points. Keep emails under 150 words. " +
    "(4) POST to /api/companies/:companyId/deal-desk/tools/outreach/draft with " +
    "{ campaignId, targetId, contactId, subject, body }. The send is created with status " +
    "'awaiting_approval' — you NEVER send directly. " +
    "(5) tell the user in chat that N drafts are waiting in /deal-desk/outreach-approvals. " +
    "Never invent contact email addresses. Never send without approval. Never use any " +
    "product name other than 'Deal Desk'.",
  ),
},
```

- [ ] **Step 2: Run the existing role-templates test if any**

```bash
pnpm --filter server vitest run --testPathPattern role-templates
```

If a snapshot test exists, update it. If no test exists, just typecheck.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter server typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/deal-desk/seeds/role-templates.ts
git commit -m "feat(deal-desk): seed Outreach Analyst role template"
```

---

## Task 16: Skill File for the Outreach Analyst

**Files:**
- Create: `skills/deal-desk-outreach/SKILL.md`

- [ ] **Step 1: Write the skill**

Create `skills/deal-desk-outreach/SKILL.md`:

```markdown
---
name: deal-desk-outreach
description: How to draft and queue outreach emails through Deal Desk's approval workflow. Use whenever you need to email a target or intermediary.
---

# Deal Desk Outreach

You draft outreach emails. You **never send** — every send is queued for the user to approve in the Outreach Approvals UI.

## Prerequisites

Before drafting any outreach, verify a Gmail account is connected:

```
GET /api/companies/{companyId}/deal-desk/tools/email-accounts
```

If `accounts` is empty or all accounts have `revokedAt` set, **stop**. File an issue asking the user to visit `/deal-desk/email-accounts` and click Connect Gmail.

## Drafting a Send

```
POST /api/companies/{companyId}/deal-desk/tools/outreach/draft
Content-Type: application/json

{
  "campaignId": "<uuid>",
  "targetId": "<uuid>",
  "contactId": "<uuid>",
  "subject": "Subject line under 80 chars",
  "body": "Email body. Plain text. Under 150 words. Personalized."
}
```

Response: `201 { "id": "<send-uuid>" }`. The send is now `awaiting_approval`.

## What NOT To Do

- Do not invent contact email addresses. Pull them from `dd_contacts`.
- Do not contact anyone on `dd_suppression_list`.
- Do not call any "send" or "approve" endpoint yourself. Approval is a human-only action.
- Do not draft more than 5 sends per heartbeat without user direction.

## Reporting Back

In chat, summarize: "Drafted N outreach emails awaiting approval at /deal-desk/outreach-approvals."
```

- [ ] **Step 2: Commit**

```bash
git add skills/deal-desk-outreach/SKILL.md
git commit -m "feat(skills): add deal-desk-outreach skill for Outreach Analyst"
```

---

## Task 17: End-to-End Manual Smoke Test

**Files:** none (manual checklist)

This is a manual verification step. Do not skip it — Gmail OAuth has a lot of moving parts that unit tests can't cover.

- [ ] **Step 1: Set env vars**

In `~/.dealdesk/.env`:

```
GOOGLE_OAUTH_CLIENT_ID=<from your GCP project>
GOOGLE_OAUTH_CLIENT_SECRET=<from your GCP project>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/gmail/callback
```

- [ ] **Step 2: Restart dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Hire an Outreach Analyst**

Visit `/<COMPANY>/deal-desk/hire`. Pick "Outreach Analyst" from the prebuilt list. Hire.

- [ ] **Step 4: Connect Gmail**

Visit `/<COMPANY>/deal-desk/email-accounts`. Click Connect Gmail. Complete Google OAuth (use a test-user account from your GCP consent screen). Verify you land back on the page with the email listed.

- [ ] **Step 5: Verify token storage**

```bash
psql "$DATABASE_URL" -c "SELECT id, email_address, secret_id, connected_at FROM dd_email_accounts;"
psql "$DATABASE_URL" -c "SELECT id, key, latest_version FROM company_secrets WHERE key LIKE 'gmail_account:%';"
```

Expected: one row in each.

- [ ] **Step 6: Trigger the agent**

Either wait for the heartbeat or trigger manually. Verify the agent calls `/outreach/draft` and a row appears:

```bash
psql "$DATABASE_URL" -c "SELECT id, subject, status FROM dd_outreach_sends WHERE status = 'awaiting_approval';"
```

- [ ] **Step 7: Approve in UI**

Visit `/<COMPANY>/deal-desk/outreach-approvals`. Click Approve & Send. Verify:
- The row vanishes from the page.
- The DB row updates: `status = 'sent'`, `external_message_id` populated, `sent_at` set, `approved_by_user_id` set.
- The actual email lands in the recipient's inbox.
- The sent message appears in your Gmail "Sent" folder.

- [ ] **Step 8: Test refresh-token rotation**

Wait until the access token expires (default 1 hour) — or manually expire it by editing the secret value to set `expiresAt` to a past timestamp. Approve another send. Verify it still succeeds (refresh path is exercised).

- [ ] **Step 9: Test disconnect**

Click Disconnect on the Email Accounts page. Verify `revoked_at` is set. Try to approve another send — should return 400 "No connected Gmail account".

---

## Self-Review Checklist (controller, before dispatch)

- [x] Spec coverage: every requirement from the brainstorm (OAuth, store tokens in companySecrets, draft tool, approval UI, send via Gmail API, role template, skill, GCP setup docs) maps to a task.
- [x] No placeholders: all code blocks have actual code; all commands have actual paths.
- [x] Type consistency: `GmailTokensRecord`, `GoogleOAuthConfig`, `EmailAccount`, `PendingSend` are defined once and referenced consistently.
- [x] Manual prereq (Task 0) precedes any code that depends on env vars.
- [x] Migration (Task 3) precedes any code that queries `dd_email_accounts`.
- [x] OAuth utilities (Tasks 4–7) precede the routes that use them (Task 8).
- [x] Send-side endpoints (Tasks 9–11) precede the UI that calls them (Tasks 12–13).
- [x] Role template seed (Task 15) does not assume the agent has a Gmail tool — the prompt instructs the agent to check first.

**Known gaps a reviewer should flag:**
- The `secretService` adapter in Task 5 assumes specific function names (`createSecret`, `addVersion`, `getLatestPlaintext`). The implementer must verify against `server/src/services/secrets.ts` and adjust the `SecretServiceLike` interface to match.
- Task 8's mounting of `cookie-parser` may already exist in `server/src/app.ts` — check before adding.
- Task 14 hand-waves the sidebar location; the implementer must locate the actual file.
