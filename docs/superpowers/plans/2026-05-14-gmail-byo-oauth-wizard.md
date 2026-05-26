# Gmail BYO OAuth Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the env-var-only Gmail OAuth client config with a per-company setup wizard on the Email Accounts page. Each company brings their own GCP project + OAuth client, pastes Client ID + Secret into the UI, and the OAuth route reads those credentials from `companySecrets` instead of `process.env`.

**Architecture:** Per-company OAuth client credentials are stored as two `companySecrets` rows (`gmail_oauth.client_id` and `gmail_oauth.client_secret`) using the `local_encrypted` provider. The redirect URI is derived server-side from `DEALDESK_PUBLIC_URL` (or `req.protocol + req.get("host")` as fallback) — no per-company config needed for it. The OAuth `/start` route reads per-company credentials at request time; if missing, returns 412 "Setup required". The Email Accounts page renders a 3-step wizard when credentials are missing: (1) instructions + copyable redirect URI, (2) paste Client ID + Secret, (3) Connect Gmail button.

**Tech Stack:** Same as before — Express, Drizzle, React + Vite, Vitest. Uses the existing `secretService` and `companySecrets` table. No new tables.

---

## File Structure

**New files:**
- `server/src/deal-desk/gmail/client-config.ts` — load/save per-company OAuth client credentials via `secretService`
- `server/src/deal-desk/gmail/__tests__/client-config.test.ts`
- `server/src/deal-desk/tools/gmail-client-config.ts` — HTTP handlers (GET/POST/DELETE)
- `server/src/deal-desk/tools/__tests__/gmail-client-config.test.ts`
- `ui/src/pages/deal-desk/GmailSetupWizard.tsx` — 3-step wizard component
- `ui/src/pages/deal-desk/GmailSetupWizard.test.tsx`

**Modified files:**
- `server/src/routes/gmail-oauth.ts` — fetch per-company credentials at request time; derive redirect URI from request or `DEALDESK_PUBLIC_URL`
- `server/src/routes/__tests__/gmail-oauth.test.ts` — update tests for the new credential resolution path
- `server/src/deal-desk/tools/index.ts` — register the three new gmail-client-config routes
- `ui/src/pages/deal-desk/EmailAccounts.tsx` — show wizard when credentials are missing, normal flow when present

**Conventions:**
- Per-company secret keys: `gmail_oauth.client_id` and `gmail_oauth.client_secret` (note the dot — sortable, namespaced)
- Both stored with `provider: "local_encrypted"`, `name` matching the key for clarity

---

## Task 1: Per-company client config service

**Files:**
- Create: `server/src/deal-desk/gmail/client-config.ts`
- Create: `server/src/deal-desk/gmail/__tests__/client-config.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/src/deal-desk/gmail/__tests__/client-config.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  saveGmailOAuthClient,
  loadGmailOAuthClient,
  deleteGmailOAuthClient,
  type GmailClientConfigStore,
} from "../client-config";

describe("Gmail OAuth client config", () => {
  it("saveGmailOAuthClient stores client_id and client_secret as two secrets", async () => {
    const writes: Array<{ key: string; plaintext: string }> = [];
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ key, plaintext }) => {
        writes.push({ key, plaintext });
        return { secretId: `sec-${key}` };
      }),
      replace: vi.fn(),
      remove: vi.fn(),
      load: vi.fn(),
    };
    await saveGmailOAuthClient(
      { companyId: "co-1", clientId: "abc.apps.googleusercontent.com", clientSecret: "GOCSPX-xxx" },
      { store },
    );
    expect(writes).toEqual([
      { key: "gmail_oauth.client_id", plaintext: "abc.apps.googleusercontent.com" },
      { key: "gmail_oauth.client_secret", plaintext: "GOCSPX-xxx" },
    ]);
  });

  it("saveGmailOAuthClient replaces existing secrets when keys already exist", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockImplementation(async ({ key }) =>
        key === "gmail_oauth.client_id" ? { secretId: "old-id" } : { secretId: "old-secret" },
      ),
      create: vi.fn(),
      replace: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      load: vi.fn(),
    };
    await saveGmailOAuthClient(
      { companyId: "co-1", clientId: "new", clientSecret: "new-secret" },
      { store },
    );
    expect(store.replace).toHaveBeenCalledTimes(2);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("loadGmailOAuthClient returns null when either secret is missing", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      replace: vi.fn(),
      remove: vi.fn(),
      load: vi.fn(),
    };
    const result = await loadGmailOAuthClient({ companyId: "co-1" }, { store });
    expect(result).toBeNull();
  });

  it("loadGmailOAuthClient returns the parsed config when both secrets exist", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockImplementation(async ({ key }) => ({
        secretId: key === "gmail_oauth.client_id" ? "id-secret" : "secret-secret",
      })),
      create: vi.fn(),
      replace: vi.fn(),
      remove: vi.fn(),
      load: vi.fn().mockImplementation(async ({ secretId }) =>
        secretId === "id-secret" ? "the-id" : "the-secret",
      ),
    };
    const result = await loadGmailOAuthClient({ companyId: "co-1" }, { store });
    expect(result).toEqual({ clientId: "the-id", clientSecret: "the-secret" });
  });

  it("deleteGmailOAuthClient removes both secrets if they exist", async () => {
    const store: GmailClientConfigStore = {
      getByKey: vi.fn().mockImplementation(async ({ key }) => ({
        secretId: key === "gmail_oauth.client_id" ? "id-secret" : "secret-secret",
      })),
      create: vi.fn(),
      replace: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
      load: vi.fn(),
    };
    await deleteGmailOAuthClient({ companyId: "co-1" }, { store });
    expect(store.remove).toHaveBeenCalledWith({ companyId: "co-1", secretId: "id-secret" });
    expect(store.remove).toHaveBeenCalledWith({ companyId: "co-1", secretId: "secret-secret" });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd "/Users/jackjanoian/Deal Desk/paperclip" && pnpm --filter server vitest run src/deal-desk/gmail/__tests__/client-config.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/deal-desk/gmail/client-config.ts`:

```typescript
const CLIENT_ID_KEY = "gmail_oauth.client_id";
const CLIENT_SECRET_KEY = "gmail_oauth.client_secret";

export interface GmailClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface GmailClientConfigStore {
  getByKey(args: { companyId: string; key: string }): Promise<{ secretId: string } | null>;
  create(args: {
    companyId: string;
    key: string;
    name: string;
    plaintext: string;
  }): Promise<{ secretId: string }>;
  replace(args: { companyId: string; secretId: string; plaintext: string }): Promise<void>;
  remove(args: { companyId: string; secretId: string }): Promise<void>;
  load(args: { companyId: string; secretId: string }): Promise<string>;
}

async function upsert(
  store: GmailClientConfigStore,
  companyId: string,
  key: string,
  plaintext: string,
): Promise<void> {
  const existing = await store.getByKey({ companyId, key });
  if (existing) {
    await store.replace({ companyId, secretId: existing.secretId, plaintext });
  } else {
    await store.create({ companyId, key, name: key, plaintext });
  }
}

export async function saveGmailOAuthClient(
  input: { companyId: string; clientId: string; clientSecret: string },
  deps: { store: GmailClientConfigStore },
): Promise<void> {
  await upsert(deps.store, input.companyId, CLIENT_ID_KEY, input.clientId);
  await upsert(deps.store, input.companyId, CLIENT_SECRET_KEY, input.clientSecret);
}

export async function loadGmailOAuthClient(
  input: { companyId: string },
  deps: { store: GmailClientConfigStore },
): Promise<GmailClientConfig | null> {
  const idRef = await deps.store.getByKey({ companyId: input.companyId, key: CLIENT_ID_KEY });
  const secretRef = await deps.store.getByKey({
    companyId: input.companyId,
    key: CLIENT_SECRET_KEY,
  });
  if (!idRef || !secretRef) return null;
  const [clientId, clientSecret] = await Promise.all([
    deps.store.load({ companyId: input.companyId, secretId: idRef.secretId }),
    deps.store.load({ companyId: input.companyId, secretId: secretRef.secretId }),
  ]);
  return { clientId, clientSecret };
}

export async function deleteGmailOAuthClient(
  input: { companyId: string },
  deps: { store: GmailClientConfigStore },
): Promise<void> {
  for (const key of [CLIENT_ID_KEY, CLIENT_SECRET_KEY]) {
    const ref = await deps.store.getByKey({ companyId: input.companyId, key });
    if (ref) {
      await deps.store.remove({ companyId: input.companyId, secretId: ref.secretId });
    }
  }
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/gmail/__tests__/client-config.test.ts
```
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/gmail/client-config.ts \
        server/src/deal-desk/gmail/__tests__/client-config.test.ts
git commit -m "feat(deal-desk): per-company Gmail OAuth client config service"
```

---

## Task 2: HTTP endpoints for the wizard

**Files:**
- Create: `server/src/deal-desk/tools/gmail-client-config.ts`
- Create: `server/src/deal-desk/tools/__tests__/gmail-client-config.test.ts`
- Modify: `server/src/deal-desk/tools/index.ts`

The wizard needs three endpoints:
- `GET /deal-desk/tools/gmail-oauth-client` → `{ configured: boolean, redirectUri: string }`
- `POST /deal-desk/tools/gmail-oauth-client` → save `{ clientId, clientSecret }`
- `DELETE /deal-desk/tools/gmail-oauth-client` → remove

We never return the actual credential values — only a boolean indicating whether they're set. The redirect URI is computed and returned so the wizard can show the exact value to paste into GCP.

- [ ] **Step 1: Write failing test**

Create `server/src/deal-desk/tools/__tests__/gmail-client-config.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  gmailClientConfigGetHandler,
  gmailClientConfigPostHandler,
  gmailClientConfigDeleteHandler,
} from "../gmail-client-config.js";

const baseDeps = {
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn(),
  deleteConfig: vi.fn(),
  resolveRedirectUri: () => "http://localhost:3000/api/oauth/gmail/callback",
};

describe("Gmail OAuth client config endpoints", () => {
  it("GET returns configured:false and the redirect URI when no credentials saved", async () => {
    const app = express();
    app.get("/c/:companyId/gmail-oauth-client", gmailClientConfigGetHandler(baseDeps as never));
    const res = await request(app).get("/c/co-1/gmail-oauth-client");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      configured: false,
      redirectUri: "http://localhost:3000/api/oauth/gmail/callback",
    });
  });

  it("GET returns configured:true when credentials exist", async () => {
    const app = express();
    app.get(
      "/c/:companyId/gmail-oauth-client",
      gmailClientConfigGetHandler({
        ...baseDeps,
        loadConfig: vi.fn().mockResolvedValue({ clientId: "x", clientSecret: "y" }),
      } as never),
    );
    const res = await request(app).get("/c/co-1/gmail-oauth-client");
    expect(res.body.configured).toBe(true);
  });

  it("POST returns 400 when clientId is missing", async () => {
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/gmail-oauth-client", gmailClientConfigPostHandler(baseDeps as never));
    const res = await request(app)
      .post("/c/co-1/gmail-oauth-client")
      .send({ clientSecret: "GOCSPX-xxx" });
    expect(res.status).toBe(400);
  });

  it("POST saves both fields and returns ok", async () => {
    const saveConfig = vi.fn().mockResolvedValue(undefined);
    const app = express();
    app.use(express.json());
    app.post(
      "/c/:companyId/gmail-oauth-client",
      gmailClientConfigPostHandler({ ...baseDeps, saveConfig } as never),
    );
    const res = await request(app).post("/c/co-1/gmail-oauth-client").send({
      clientId: "abc.apps.googleusercontent.com",
      clientSecret: "GOCSPX-xxx",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(saveConfig).toHaveBeenCalledWith({
      companyId: "co-1",
      clientId: "abc.apps.googleusercontent.com",
      clientSecret: "GOCSPX-xxx",
    });
  });

  it("DELETE removes credentials and returns ok", async () => {
    const deleteConfig = vi.fn().mockResolvedValue(undefined);
    const app = express();
    app.delete(
      "/c/:companyId/gmail-oauth-client",
      gmailClientConfigDeleteHandler({ ...baseDeps, deleteConfig } as never),
    );
    const res = await request(app).delete("/c/co-1/gmail-oauth-client");
    expect(res.status).toBe(200);
    expect(deleteConfig).toHaveBeenCalledWith({ companyId: "co-1" });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/gmail-client-config.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/src/deal-desk/tools/gmail-client-config.ts`:

```typescript
import type { Request, Response } from "express";
import { z } from "zod";
import type { GmailClientConfig } from "../gmail/client-config.js";

export interface GmailClientConfigDeps {
  loadConfig(args: { companyId: string }): Promise<GmailClientConfig | null>;
  saveConfig(args: { companyId: string; clientId: string; clientSecret: string }): Promise<void>;
  deleteConfig(args: { companyId: string }): Promise<void>;
  resolveRedirectUri(req: Request): string;
}

export function gmailClientConfigGetHandler(deps: GmailClientConfigDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const existing = await deps.loadConfig({ companyId });
    res.status(200).json({
      configured: existing !== null,
      redirectUri: deps.resolveRedirectUri(req),
    });
  };
}

const postBodySchema = z.object({
  clientId: z.string().min(10),
  clientSecret: z.string().min(10),
});

export function gmailClientConfigPostHandler(deps: GmailClientConfigDeps) {
  return async (req: Request, res: Response) => {
    const parsed = postBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string;
    await deps.saveConfig({
      companyId,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
    });
    res.status(200).json({ ok: true });
  };
}

export function gmailClientConfigDeleteHandler(deps: GmailClientConfigDeps) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    await deps.deleteConfig({ companyId });
    res.status(200).json({ ok: true });
  };
}
```

- [ ] **Step 4: Wire registration**

Edit `server/src/deal-desk/tools/index.ts`. Add at the top of the imports:

```typescript
import {
  gmailClientConfigGetHandler,
  gmailClientConfigPostHandler,
  gmailClientConfigDeleteHandler,
} from "./gmail-client-config.js";
import {
  saveGmailOAuthClient,
  loadGmailOAuthClient,
  deleteGmailOAuthClient,
  type GmailClientConfigStore,
} from "../gmail/client-config.js";
import { secretService } from "../../services/secrets.js";
import { eq, and } from "drizzle-orm";  // and may already be imported
import { companySecrets } from "@dealdesk/db";
```

Inside the existing registration function, add a helper that builds the store adapter, then register the three routes:

```typescript
const buildClientConfigStore = (): GmailClientConfigStore => {
  const realSvc = secretService(db);
  return {
    getByKey: async ({ companyId, key }) => {
      const row = await db
        .select({ id: companySecrets.id })
        .from(companySecrets)
        .where(
          and(
            eq(companySecrets.companyId, companyId),
            eq(companySecrets.key, key),
            eq(companySecrets.status, "active"),
          ),
        )
        .limit(1);
      return row[0] ? { secretId: row[0].id } : null;
    },
    create: async ({ companyId, key, name, plaintext }) => {
      const created = await realSvc.create(companyId, {
        name,
        key,
        provider: "local_encrypted",
        value: plaintext,
        description: "Gmail OAuth client credentials (Outreach Analyst)",
      });
      return { secretId: created.id };
    },
    replace: async ({ companyId, secretId, plaintext }) => {
      await realSvc.rotate(secretId, { value: plaintext });
    },
    remove: async ({ companyId, secretId }) => {
      await realSvc.remove(secretId);
    },
    load: async ({ companyId, secretId }) => {
      return await realSvc.resolveSecretValue(companyId, secretId, "latest");
    },
  };
};

const clientConfigDeps = {
  loadConfig: ({ companyId }: { companyId: string }) =>
    loadGmailOAuthClient({ companyId }, { store: buildClientConfigStore() }),
  saveConfig: (args: { companyId: string; clientId: string; clientSecret: string }) =>
    saveGmailOAuthClient(args, { store: buildClientConfigStore() }),
  deleteConfig: ({ companyId }: { companyId: string }) =>
    deleteGmailOAuthClient({ companyId }, { store: buildClientConfigStore() }),
  resolveRedirectUri: (req: Request) => {
    const fromEnv = process.env.DEALDESK_PUBLIC_URL;
    const base = fromEnv ?? `${req.protocol}://${req.get("host")}`;
    return `${base.replace(/\/$/, "")}/api/oauth/gmail/callback`;
  },
};

parent.get("/gmail-oauth-client", gmailClientConfigGetHandler(clientConfigDeps));
parent.post("/gmail-oauth-client", gmailClientConfigPostHandler(clientConfigDeps));
parent.delete("/gmail-oauth-client", gmailClientConfigDeleteHandler(clientConfigDeps));
```

(Add `import type { Request } from "express";` to the top if not already present.)

> **Note:** Verify the `companySecrets` schema exports `companyId`, `key`, `status` (it does per the recon). If field names differ slightly in the actual schema (e.g., `companyId` vs `dealDeskCompanyId`), match them — `companySecrets` is in the core schema, not the Deal Desk schema, so it uses `companyId`.

- [ ] **Step 5: Run test, verify PASS**

```bash
pnpm --filter server vitest run src/deal-desk/tools/__tests__/gmail-client-config.test.ts
```
Expected: PASS (5/5).

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter server typecheck
```
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add server/src/deal-desk/tools/gmail-client-config.ts \
        server/src/deal-desk/tools/__tests__/gmail-client-config.test.ts \
        server/src/deal-desk/tools/index.ts
git commit -m "feat(deal-desk): GET/POST/DELETE endpoints for per-company Gmail OAuth client config"
```

---

## Task 3: Use per-company credentials in OAuth /start and /callback

**Files:**
- Modify: `server/src/routes/gmail-oauth.ts`
- Modify: `server/src/routes/__tests__/gmail-oauth.test.ts`

The OAuth route currently reads `input.config` (server env vars). Switch it to fetch per-company credentials at request time using the same `client-config` service. Derive the redirect URI the same way the GET endpoint does.

- [ ] **Step 1: Update test expectations**

Edit `server/src/routes/__tests__/gmail-oauth.test.ts`. Replace the existing two tests with:

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createGmailOAuthRouter } from "../gmail-oauth.js";

describe("Gmail OAuth routes", () => {
  it("GET /start redirects to Google authorize URL when company has credentials", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        loadClientConfig: async () => ({ clientId: "cid", clientSecret: "csec" }),
        resolveRedirectUri: () => "https://x.test/cb",
        resolveCompanyId: () => "co-1",
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start?companyId=co-1");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(res.headers.location).toContain("client_id=cid");
    expect(res.headers["set-cookie"]?.[0]).toContain("dd_gmail_oauth_state=");
  });

  it("GET /start returns 412 when company has no Gmail OAuth client configured", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        loadClientConfig: async () => null,
        resolveRedirectUri: () => "https://x.test/cb",
        resolveCompanyId: () => "co-1",
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start?companyId=co-1");
    expect(res.status).toBe(412);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("GET /start returns 400 when companyId can't be resolved", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        loadClientConfig: async () => null,
        resolveRedirectUri: () => "https://x.test/cb",
        resolveCompanyId: () => null,
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter server vitest run src/routes/__tests__/gmail-oauth.test.ts
```
Expected: FAIL — `loadClientConfig` not in interface.

- [ ] **Step 3: Refactor `gmail-oauth.ts`**

Edit `server/src/routes/gmail-oauth.ts`. Replace the `CreateRouterInput` interface and the `createGmailOAuthRouter` function:

```typescript
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import {
  buildGmailAuthorizeUrl,
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
} from "../deal-desk/gmail/oauth.js";
import { saveGmailTokens, type GmailSecretStore } from "../deal-desk/gmail/tokens.js";
import type { GmailClientConfig } from "../deal-desk/gmail/client-config.js";
import type { Db } from "@dealdesk/db";
import { ddEmailAccounts } from "@dealdesk/db";
import { secretService } from "../services/secrets.js";

const STATE_COOKIE = "dd_gmail_oauth_state";

export interface CreateRouterInput {
  loadClientConfig: (companyId: string) => Promise<GmailClientConfig | null>;
  resolveRedirectUri: (req: Request) => string;
  resolveCompanyId: (req: Request) => string | null;
  deps: { db: Db };
}

export function createGmailOAuthRouter(input: CreateRouterInput): Router {
  const router = Router();

  router.get("/start", async (req: Request, res: Response) => {
    const companyId = input.resolveCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    const clientConfig = await input.loadClientConfig(companyId);
    if (!clientConfig) {
      res.status(412).json({
        ok: false,
        reason:
          "Gmail OAuth client not configured for this company. " +
          "Visit /deal-desk/email-accounts to set it up.",
      });
      return;
    }
    const redirectUri = input.resolveRedirectUri(req);
    const stateValue = `${companyId}.${crypto.randomBytes(16).toString("hex")}`;
    res.cookie(STATE_COOKIE, stateValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: redirectUri.startsWith("https://"),
      maxAge: 10 * 60_000,
    });
    const url = buildGmailAuthorizeUrl({
      clientId: clientConfig.clientId,
      redirectUri,
      state: stateValue,
    });
    res.redirect(url);
  });

  router.get("/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      STATE_COOKIE
    ];
    if (!code || !state || !cookieState || state !== cookieState) {
      res.status(400).send("Invalid OAuth state");
      return;
    }
    const companyId = state.split(".")[0]!;
    const clientConfig = await input.loadClientConfig(companyId);
    if (!clientConfig) {
      res.status(412).send("Gmail OAuth client not configured for this company");
      return;
    }
    const redirectUri = input.resolveRedirectUri(req);
    const tokens = await exchangeCodeForTokens({
      clientId: clientConfig.clientId,
      clientSecret: clientConfig.clientSecret,
      redirectUri,
      code,
    });
    const emailAddress = await fetchGoogleUserEmail(tokens.accessToken);

    const realSvc = secretService(input.deps.db);
    const store: GmailSecretStore = {
      store: async ({ companyId: cid, key, name, plaintext }) => {
        const created = await realSvc.create(cid, {
          name,
          key,
          provider: "local_encrypted",
          value: plaintext,
          description: "Gmail OAuth refresh + access tokens for Outreach Analyst",
        });
        return { secretId: created.id };
      },
      loadLatest: async ({ companyId: cid, secretId }) => {
        return await realSvc.resolveSecretValue(cid, secretId, "latest");
      },
    };

    const secretId = await saveGmailTokens(
      { companyId, emailAddress, tokens },
      { store },
    );
    await input.deps.db.insert(ddEmailAccounts).values({
      dealDeskCompanyId: companyId,
      provider: "gmail",
      emailAddress,
      secretId,
    });

    res.clearCookie(STATE_COOKIE);
    res.redirect(
      `/${companyId}/deal-desk/email-accounts?connected=${encodeURIComponent(emailAddress)}`,
    );
  });

  return router;
}
```

- [ ] **Step 4: Update the mounting in `server/src/app.ts`**

Find where `createGmailOAuthRouter` is mounted (it currently passes `config: opts.googleOAuth ?? null`). Replace with:

```typescript
import { secretService } from "./services/secrets.js";
import {
  loadGmailOAuthClient,
  type GmailClientConfigStore,
} from "./deal-desk/gmail/client-config.js";
import { companySecrets } from "@dealdesk/db";
import { eq, and } from "drizzle-orm";

const buildClientConfigStore = (): GmailClientConfigStore => {
  const realSvc = secretService(db);
  return {
    getByKey: async ({ companyId, key }) => {
      const row = await db
        .select({ id: companySecrets.id })
        .from(companySecrets)
        .where(
          and(
            eq(companySecrets.companyId, companyId),
            eq(companySecrets.key, key),
            eq(companySecrets.status, "active"),
          ),
        )
        .limit(1);
      return row[0] ? { secretId: row[0].id } : null;
    },
    create: async () => {
      throw new Error("create() not used in OAuth route");
    },
    replace: async () => {
      throw new Error("replace() not used in OAuth route");
    },
    remove: async () => {
      throw new Error("remove() not used in OAuth route");
    },
    load: async ({ companyId, secretId }) => {
      return await realSvc.resolveSecretValue(companyId, secretId, "latest");
    },
  };
};

api.use(
  "/oauth/gmail",
  createGmailOAuthRouter({
    loadClientConfig: (companyId) =>
      loadGmailOAuthClient({ companyId }, { store: buildClientConfigStore() }),
    resolveRedirectUri: (req) => {
      const base = process.env.DEALDESK_PUBLIC_URL ?? `${req.protocol}://${req.get("host")}`;
      return `${base.replace(/\/$/, "")}/api/oauth/gmail/callback`;
    },
    resolveCompanyId: (req) =>
      (req.query.companyId as string | undefined) ??
      (req as Request & { user?: { companyId?: string } }).user?.companyId ??
      null,
    deps: { db },
  }),
);
```

The `googleOAuth` option that was added to `createApp` opts in the prior plan is now unused — remove it from the `CreateAppOpts` interface and from the call site in `index.ts`. Also remove the `import type { GoogleOAuthConfig }` from `app.ts` if it becomes unused.

The `Config.googleOAuth` field in `server/src/config.ts` and the env vars `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`/`GOOGLE_OAUTH_REDIRECT_URI` are no longer required — leave them in place (they're harmless if set, ignored if not) to avoid breaking any local `.env` files that already have them. But add a deprecation comment near the field:

```typescript
// DEPRECATED: per-company OAuth client credentials are now stored via
// /deal-desk/tools/gmail-oauth-client. These env vars are no longer read.
googleOAuth: GoogleOAuthConfig | null;
```

- [ ] **Step 5: Update Task 10 (outreach-approve) to use per-company credentials**

`outreach-approve.ts` currently takes `googleOAuth: GoogleOAuthConfig | null` from `deps`. Update to take `loadClientConfig` instead:

In `server/src/deal-desk/tools/outreach-approve.ts`:

Replace:
```typescript
import type { GoogleOAuthConfig } from "../../config.js";

export interface ApproveDeps {
  db: Db;
  googleOAuth: GoogleOAuthConfig | null;
  // ...
}
```

With:
```typescript
import type { GmailClientConfig } from "../gmail/client-config.js";

export interface ApproveDeps {
  db: Db;
  loadClientConfig: (companyId: string) => Promise<GmailClientConfig | null>;
  // ...
}
```

In the handler body, replace the `if (!deps.googleOAuth)` 503 check and the subsequent `deps.googleOAuth.clientId` / `deps.googleOAuth.clientSecret` references with:

```typescript
const clientConfig = await deps.loadClientConfig(send.dealDeskCompanyId);
if (!clientConfig) {
  res.status(412).json({
    ok: false,
    reason: "Gmail OAuth client not configured for this company",
  });
  return;
}
// ...later when calling ensureFreshAccessToken:
const fresh = await ensureFreshAccessToken({
  tokens: stored,
  clientId: clientConfig.clientId,
  clientSecret: clientConfig.clientSecret,
});
```

Update the test in `outreach-approve.test.ts` to match: replace `googleOAuth: { clientId: "c", ... }` with `loadClientConfig: async () => ({ clientId: "c", clientSecret: "s" })`, and replace `googleOAuth: null` with `loadClientConfig: async () => null` and expect a 412 (not 503).

Update the registration in `tools/index.ts`: replace `outreachApproveHandler({ db, googleOAuth: opts.googleOAuth ?? null })` with `outreachApproveHandler({ db, loadClientConfig: clientConfigDeps.loadConfig })` (reusing the helper from Task 2).

The `opts: { googleOAuth? }` parameter on `registerDealDeskTools` and `dealDeskRoutes` and `app.ts` is no longer needed — remove it.

- [ ] **Step 6: Run all related tests**

```bash
pnpm --filter server vitest run \
  src/routes/__tests__/gmail-oauth.test.ts \
  src/deal-desk/tools/__tests__/outreach-approve.test.ts \
  src/deal-desk/tools/__tests__/gmail-client-config.test.ts
```
Expected: PASS (3 + 2 + 5 = 10 tests).

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter server typecheck
```
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/gmail-oauth.ts \
        server/src/routes/__tests__/gmail-oauth.test.ts \
        server/src/app.ts \
        server/src/index.ts \
        server/src/config.ts \
        server/src/deal-desk/tools/outreach-approve.ts \
        server/src/deal-desk/tools/__tests__/outreach-approve.test.ts \
        server/src/deal-desk/tools/index.ts \
        server/src/routes/deal-desk.ts
git commit -m "refactor(deal-desk): read Gmail OAuth client per-company instead of env vars"
```

(Only add the files you actually modified — verify with `git status` first.)

---

## Task 4: Setup Wizard UI component

**Files:**
- Create: `ui/src/pages/deal-desk/GmailSetupWizard.tsx`
- Create: `ui/src/pages/deal-desk/GmailSetupWizard.test.tsx`

The wizard is a self-contained component. It takes a `companyId`, the `redirectUri` to display, and an `onSaved` callback. Internally it walks 3 steps:
1. Instructions panel (with copyable redirect URI)
2. Form (Client ID + Client Secret inputs)
3. (After save) Connect Gmail button

For v1, keep all three on one scrollable page rather than a multi-step wizard component — simpler to build, easier to reference instructions while filling in the form.

- [ ] **Step 1: Write failing test**

Create `ui/src/pages/deal-desk/GmailSetupWizard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GmailSetupWizard } from "./GmailSetupWizard";

describe("GmailSetupWizard", () => {
  it("renders the redirect URI prominently for the user to copy", () => {
    render(
      <GmailSetupWizard
        redirectUri="http://localhost:3000/api/oauth/gmail/callback"
        onSave={vi.fn()}
        saving={false}
      />,
    );
    expect(
      screen.getByText("http://localhost:3000/api/oauth/gmail/callback"),
    ).toBeInTheDocument();
  });

  it("renders inputs for Client ID and Client Secret", () => {
    render(<GmailSetupWizard redirectUri="x" onSave={vi.fn()} saving={false} />);
    expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/client secret/i)).toBeInTheDocument();
  });

  it("calls onSave with the entered credentials when Save is clicked", () => {
    const onSave = vi.fn();
    render(<GmailSetupWizard redirectUri="x" onSave={onSave} saving={false} />);
    fireEvent.change(screen.getByLabelText(/client id/i), {
      target: { value: "the-id" },
    });
    fireEvent.change(screen.getByLabelText(/client secret/i), {
      target: { value: "the-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save credentials/i }));
    expect(onSave).toHaveBeenCalledWith({
      clientId: "the-id",
      clientSecret: "the-secret",
    });
  });

  it("disables the Save button while saving", () => {
    render(<GmailSetupWizard redirectUri="x" onSave={vi.fn()} saving={true} />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd "/Users/jackjanoian/Deal Desk/paperclip" && pnpm --filter ui vitest run src/pages/deal-desk/GmailSetupWizard.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `ui/src/pages/deal-desk/GmailSetupWizard.tsx`:

```tsx
import { useState } from "react";

export interface GmailSetupWizardProps {
  redirectUri: string;
  onSave: (creds: { clientId: string; clientSecret: string }) => void;
  saving: boolean;
}

export function GmailSetupWizard(props: GmailSetupWizardProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onSave({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Create a Google Cloud project</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>
            Open{" "}
            <a
              className="text-blue-600 underline"
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              console.cloud.google.com
            </a>{" "}
            and create a new project (or pick an existing one).
          </li>
          <li>
            Enable the Gmail API: <em>APIs &amp; Services → Library</em> → search "Gmail API" →
            Enable.
          </li>
          <li>
            Configure the OAuth consent screen: User type <strong>External</strong>, add scope{" "}
            <code className="px-1 bg-gray-100 rounded">
              https://www.googleapis.com/auth/gmail.send
            </code>
            , add yourself as a test user.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Create the OAuth client</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>
            <em>APIs &amp; Services → Credentials → Create Credentials → OAuth client ID</em>.
          </li>
          <li>
            Application type: <strong>Web application</strong>.
          </li>
          <li>
            Under <em>Authorized redirect URIs</em>, paste this exact value:
            <div className="mt-2 p-3 bg-gray-100 rounded font-mono text-xs break-all">
              {props.redirectUri}
            </div>
          </li>
          <li>Save and copy the Client ID and Client Secret into the form below.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. Paste your credentials</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="gmail-client-id" className="block text-sm font-medium mb-1">
              Client ID
            </label>
            <input
              id="gmail-client-id"
              type="text"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="123456789-xxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="gmail-client-secret" className="block text-sm font-medium mb-1">
              Client Secret
            </label>
            <input
              id="gmail-client-secret"
              type="password"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="GOCSPX-..."
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={props.saving}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {props.saving ? "Saving…" : "Save credentials"}
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter ui vitest run src/pages/deal-desk/GmailSetupWizard.test.tsx
```
Expected: PASS (4/4).

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter ui typecheck
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add ui/src/pages/deal-desk/GmailSetupWizard.tsx \
        ui/src/pages/deal-desk/GmailSetupWizard.test.tsx
git commit -m "feat(ui): add Gmail OAuth setup wizard component"
```

---

## Task 5: Wire wizard into EmailAccountsPage

**Files:**
- Modify: `ui/src/pages/deal-desk/EmailAccounts.tsx`
- Modify: `ui/src/pages/deal-desk/EmailAccounts.test.tsx`

Currently `EmailAccountsPage` always shows the Connect Gmail button. New behavior: on mount, fetch `/gmail-oauth-client`. If `configured: false`, render the wizard. If `configured: true`, render the existing flow plus a small "OAuth client connected ✓ [Reset]" line.

- [ ] **Step 1: Add a test for the unconfigured state**

Append to `ui/src/pages/deal-desk/EmailAccounts.test.tsx`:

```typescript
it("shows the setup wizard when the company has no OAuth client configured", () => {
  render(
    <EmailAccounts
      companyId="co-1"
      accounts={[]}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      clientConfigStatus={{
        configured: false,
        redirectUri: "http://localhost:3000/api/oauth/gmail/callback",
      }}
      onSaveClientConfig={vi.fn()}
      savingClientConfig={false}
      onResetClientConfig={vi.fn()}
    />,
  );
  expect(screen.getByText(/1\. Create a Google Cloud project/i)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /connect gmail/i })).not.toBeInTheDocument();
});

it("shows the Connect Gmail button when the company has OAuth client configured", () => {
  render(
    <EmailAccounts
      companyId="co-1"
      accounts={[]}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      clientConfigStatus={{
        configured: true,
        redirectUri: "http://localhost:3000/api/oauth/gmail/callback",
      }}
      onSaveClientConfig={vi.fn()}
      savingClientConfig={false}
      onResetClientConfig={vi.fn()}
    />,
  );
  expect(screen.getByRole("link", { name: /connect gmail/i })).toBeInTheDocument();
  expect(screen.queryByText(/1\. Create a Google Cloud project/i)).not.toBeInTheDocument();
});
```

Update the existing two tests in this file to also pass these new props (they can use the configured: true variant so the existing assertions still pass):

```typescript
const defaultClientConfigProps = {
  clientConfigStatus: {
    configured: true,
    redirectUri: "http://localhost:3000/api/oauth/gmail/callback",
  },
  onSaveClientConfig: vi.fn(),
  savingClientConfig: false,
  onResetClientConfig: vi.fn(),
};

// then in each existing test:
render(
  <EmailAccounts
    companyId="co-1"
    accounts={[/* ... */]}
    onConnect={vi.fn()}
    onDisconnect={vi.fn()}
    {...defaultClientConfigProps}
  />,
);
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter ui vitest run src/pages/deal-desk/EmailAccounts.test.tsx
```
Expected: FAIL — new props not on type.

- [ ] **Step 3: Update the component**

Edit `ui/src/pages/deal-desk/EmailAccounts.tsx`. Add the new props to the interface and render the wizard conditionally:

```tsx
import { useEffect, useState } from "react";
import { GmailSetupWizard } from "./GmailSetupWizard";
// keep existing imports

export interface ClientConfigStatus {
  configured: boolean;
  redirectUri: string;
}

export interface EmailAccountsProps {
  companyId: string;
  accounts: EmailAccount[];
  onConnect: () => void;
  onDisconnect: (id: string) => void;
  clientConfigStatus: ClientConfigStatus;
  onSaveClientConfig: (creds: { clientId: string; clientSecret: string }) => void;
  savingClientConfig: boolean;
  onResetClientConfig: () => void;
}

export function EmailAccounts(props: EmailAccountsProps) {
  const active = props.accounts.filter((a) => !a.revokedAt);

  if (!props.clientConfigStatus.configured) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Email Accounts</h1>
        <p className="text-sm text-gray-600 mb-6">
          To use the Outreach Analyst, this company needs its own Google OAuth client.
          Follow the 3 steps below.
        </p>
        <GmailSetupWizard
          redirectUri={props.clientConfigStatus.redirectUri}
          onSave={props.onSaveClientConfig}
          saving={props.savingClientConfig}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Email Accounts</h1>
      <div className="mb-4 text-xs text-gray-500">
        Google OAuth client connected.{" "}
        <button
          type="button"
          className="underline text-red-600"
          onClick={props.onResetClientConfig}
        >
          Reset
        </button>
      </div>
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
```

Update `EmailAccountsPage` to fetch the client config status, accept saves, and reset:

```tsx
export function EmailAccountsPage() {
  const { company } = useCompany();
  const companyId = company.id;
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [clientConfigStatus, setClientConfigStatus] = useState<ClientConfigStatus>({
    configured: false,
    redirectUri: "",
  });
  const [savingClientConfig, setSavingClientConfig] = useState(false);

  const refreshClientConfig = () => {
    fetch(`/api/companies/${companyId}/deal-desk/tools/gmail-oauth-client`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(setClientConfigStatus);
  };

  const refreshAccounts = () => {
    fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []));
  };

  useEffect(() => {
    refreshClientConfig();
    refreshAccounts();
  }, [companyId]);

  const onSaveClientConfig = async (creds: { clientId: string; clientSecret: string }) => {
    setSavingClientConfig(true);
    try {
      await fetch(`/api/companies/${companyId}/deal-desk/tools/gmail-oauth-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(creds),
      });
      refreshClientConfig();
    } finally {
      setSavingClientConfig(false);
    }
  };

  const onResetClientConfig = async () => {
    if (
      !window.confirm(
        "Reset Gmail OAuth client credentials for this company? You'll need to re-enter them.",
      )
    ) {
      return;
    }
    await fetch(`/api/companies/${companyId}/deal-desk/tools/gmail-oauth-client`, {
      method: "DELETE",
      credentials: "include",
    });
    refreshClientConfig();
  };

  const onDisconnect = async (id: string) => {
    await fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, revokedAt: new Date().toISOString() } : a)),
    );
  };

  return (
    <EmailAccounts
      companyId={companyId}
      accounts={accounts}
      onConnect={() => {}}
      onDisconnect={onDisconnect}
      clientConfigStatus={clientConfigStatus}
      onSaveClientConfig={onSaveClientConfig}
      savingClientConfig={savingClientConfig}
      onResetClientConfig={onResetClientConfig}
    />
  );
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
pnpm --filter ui vitest run src/pages/deal-desk/EmailAccounts.test.tsx
```
Expected: PASS (4/4 — 2 original updated + 2 new).

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter ui typecheck
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add ui/src/pages/deal-desk/EmailAccounts.tsx \
        ui/src/pages/deal-desk/EmailAccounts.test.tsx
git commit -m "feat(ui): show Gmail OAuth setup wizard when company is unconfigured"
```

---

## Task 6: Manual smoke test

**Files:** none (manual checklist)

- [ ] **Step 1: Restart dev server** (no env vars needed now)

```bash
pnpm dev
```

- [ ] **Step 2: Visit `/<COMPANY>/deal-desk/email-accounts`**

Expected: setup wizard appears. The redirect URI box shows `http://localhost:3000/api/oauth/gmail/callback`.

- [ ] **Step 3: Complete the GCP setup** (per the wizard's instructions). Use the displayed redirect URI verbatim when registering the OAuth client.

- [ ] **Step 4: Paste Client ID + Secret into the form, click Save**

Expected: page refreshes. Wizard is gone. "Connect Gmail" button now visible. "Google OAuth client connected." line shows.

- [ ] **Step 5: Verify in DB**

```bash
psql "$DATABASE_URL" -c \
  "SELECT name, key FROM company_secrets WHERE key LIKE 'gmail_oauth.%';"
```

Expected: two rows — `gmail_oauth.client_id` and `gmail_oauth.client_secret`.

- [ ] **Step 6: Click Connect Gmail**

Expected: redirect to Google → OAuth consent → land back on Email Accounts with the connected email listed.

- [ ] **Step 7: Test reset**

Click "Reset" next to the connected indicator. Confirm. Expected: wizard reappears. The two `company_secrets` rows are gone (or status `revoked`).

- [ ] **Step 8: Verify approve-and-send still works** (regression check on Task 3 changes)

Run an Outreach Analyst heartbeat → approve a draft. Expected: email lands.

---

## Self-Review Checklist

- [x] Spec coverage: BYO per-company credentials, inline wizard, no env-var requirement, redirect URI displayed for the user — all addressed.
- [x] No placeholders.
- [x] Type consistency: `GmailClientConfig`, `GmailClientConfigStore`, `ClientConfigStatus`, `GmailSecretStore` defined once and referenced consistently.
- [x] Task 3 deprecates the env-var path cleanly without breaking existing `.env` files.
- [x] Task 5 props are added to the existing component without breaking the existing tests (they're updated in lockstep).

**Known gaps:**
- The Reset flow only deletes the `companySecrets` rows for the OAuth client. It does NOT revoke any already-connected Gmail accounts (they stay in `dd_email_accounts`). If the operator regenerates a different OAuth client in GCP, those connected accounts may still work for a while because the refresh tokens are tied to the old client and Google will reject them on next refresh — at which point the `outreach-approve` endpoint will surface the error and the user can re-connect. Acceptable for v1.
- The wizard does not validate the credentials by attempting an OAuth round-trip on save. If the user pastes a bad Client ID, they'll only find out when they click Connect Gmail. Acceptable for v1.
