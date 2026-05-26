# Deal Desk Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three cross-tenant IDOR/authz holes (C1, C2, C3) found in the Deal Desk security review, plus the mass-assignment medium (M3) and three low-severity hygiene fixes (L1, L2, L3) on branch `feat/dealdesk-full-rebrand`.

**Architecture:** Every fix is surgical — narrow `where` clauses, one extra authz call, one whitelist, and three small response/cookie/actor tweaks. No new abstractions. Each task is independently testable via existing Vitest patterns under `server/src/deal-desk/tools/__tests__/` and `server/src/routes/__tests__/`.

**Tech Stack:** Express + Drizzle ORM (Postgres), Zod, Vitest. Test DB is the embedded Postgres helper at `cli/src/__tests__/helpers/embedded-postgres.ts` (already used by Deal Desk tests).

**Scope note — items intentionally excluded:**
- **H1 (email header CRLF injection in `server/src/deal-desk/gmail/send.ts`)** and **H2 (Host-header-derived OAuth `redirect_uri`)** are HIGH severity and exploitable. The user prompt skipped HIGH. **Strongly recommend a follow-up plan** covering both before merge. They are not addressed here.
- **M1 (rate limiting)** and **M2 (CSRF audit)** are larger architectural efforts that touch shared infrastructure (rate-limit middleware, cookie config). They warrant their own plans. Only **M3** is addressed in this plan because it is the same surgical class of fix as C1–C3.

---

## File Structure

**Files modified:**
- `server/src/deal-desk/tools/outreach-approve.ts` — add tenant filter to send lookups; tighten approve-by-actor (C1, L3)
- `server/src/deal-desk/tools/outreach-edit.ts` — add tenant filter to send lookup and update (C1)
- `server/src/deal-desk/tools/index.ts` — add tenant filter to DELETE `/email-accounts/:id` (C2)
- `server/src/deal-desk/tools/enrich-contact.ts` — add tenant filter to contact update (C2)
- `server/src/deal-desk/tools/create-target.ts` — stop leaking DB error messages (L1)
- `server/src/routes/gmail-oauth.ts` — drop conditional `secure` cookie flag (L2)
- `server/src/app.ts` — pass an `authorizeCompanyId` callback into `createGmailOAuthRouter` (C3)
- `server/src/routes/deal-desk.ts` — whitelist updatable thesis columns in PATCH (M3)

**Files created:** none.

**Test files modified or created:**
- `server/src/deal-desk/tools/__tests__/outreach-approve.test.ts` (or create)
- `server/src/deal-desk/tools/__tests__/outreach-edit.test.ts` (or create)
- `server/src/deal-desk/tools/__tests__/email-accounts.test.ts` (or create)
- `server/src/deal-desk/tools/__tests__/enrich-contact.test.ts` (or create)
- `server/src/routes/__tests__/gmail-oauth.test.ts` (or create)
- `server/src/routes/__tests__/deal-desk-thesis.test.ts` (or create)

Before writing a new test file, check whether one already exists in that directory and append to it instead. The repo uses Vitest with `describe`/`it`; follow the existing pattern in any neighboring `*.test.ts`.

---

## Phase 1 — CRITICAL (C1, C2, C3)

### Task 1: C1 — Tenant-scope outreach approve handler

**Why:** `outreachApproveHandler` looks up `ddOutreachSends` by `id` only at `outreach-approve.ts:53-55` and `:265-267`. The URL's `:companyId` is gated by `assertCompanyAccess` in `routes/deal-desk.ts:350` but never compared against `send.dealDeskCompanyId`. An attacker with access to company A can POST `/api/companies/A/deal-desk/tools/outreach/sends/<B-send-id>/approve` to send mail from company B's Gmail account.

**Files:**
- Modify: `server/src/deal-desk/tools/outreach-approve.ts` (lines 51-55, 263-271)
- Test: `server/src/deal-desk/tools/__tests__/outreach-approve.test.ts`

- [ ] **Step 1: Write the failing test**

In `server/src/deal-desk/tools/__tests__/outreach-approve.test.ts`, add:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { outreachApproveHandler, outreachRejectHandler } from "../outreach-approve.js";
import { makeTestDb, seedTwoCompaniesWithSend } from "./_helpers.js"; // create if missing — see Step 1a

describe("outreachApproveHandler — tenant isolation (C1)", () => {
  it("returns 404 when the URL companyId does not own the send", async () => {
    const { db, companyA, companyB, sendIdForB } = await seedTwoCompaniesWithSend();
    const handler = outreachApproveHandler({
      db,
      loadClientConfig: async () => ({ clientId: "x", clientSecret: "y" }),
    });
    const req: any = {
      params: { companyId: companyA, id: sendIdForB },
      actor: { type: "board", userId: "00000000-0000-0000-0000-000000000001", source: "session" },
    };
    let status = 0;
    let body: any = null;
    const res: any = { status(s: number) { status = s; return this; }, json(b: any) { body = b; } };
    await handler(req, res);
    expect(status).toBe(404);
    expect(body.ok).toBe(false);
  });
});

describe("outreachRejectHandler — tenant isolation (C1)", () => {
  it("returns 404 when the URL companyId does not own the send", async () => {
    const { db, companyA, sendIdForB } = await seedTwoCompaniesWithSend();
    const handler = outreachRejectHandler({ db });
    const req: any = {
      params: { companyId: companyA, id: sendIdForB },
      actor: { type: "board", userId: "00000000-0000-0000-0000-000000000001", source: "session" },
    };
    let status = 0;
    const res: any = { status(s: number) { status = s; return this; }, json() {} };
    await handler(req, res);
    expect(status).toBe(404);
  });
});
```

**Step 1a:** If `_helpers.ts` does not exist, create it with a `seedTwoCompaniesWithSend()` helper that inserts two `companies` rows, one `dd_outreach_sends` row owned by company B in `awaiting_approval` status, and returns the IDs. Use the embedded Postgres helper at `cli/src/__tests__/helpers/embedded-postgres.ts` and the existing Drizzle schema. Mirror the seeding style used in any neighboring deal-desk test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/outreach-approve.test.ts`
Expected: FAIL — handler currently returns 412 (no Gmail client) or other status, not 404 with `ok:false`.

- [ ] **Step 3: Add tenant filter to send lookups in approve and reject**

In `server/src/deal-desk/tools/outreach-approve.ts`:

Replace line 53-55:
```ts
    const send = await deps.db.query.ddOutreachSends.findFirst({
      where: eq(ddOutreachSends.id, sendId),
    });
```
with:
```ts
    const send = await deps.db.query.ddOutreachSends.findFirst({
      where: and(
        eq(ddOutreachSends.id, sendId),
        eq(ddOutreachSends.dealDeskCompanyId, req.params.companyId as string),
      ),
    });
```

Replace line 265-267 (inside `outreachRejectHandler`) with the same `and(...)` pattern.

Add `and` to the import on line 3:
```ts
import { and, eq } from "drizzle-orm";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/outreach-approve.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full deal-desk suite to catch regressions**

Run: `cd server && pnpm vitest run src/deal-desk`
Expected: All tests pass (or only pre-existing failures unrelated to outreach).

- [ ] **Step 6: Commit**

```bash
git add server/src/deal-desk/tools/outreach-approve.ts \
        server/src/deal-desk/tools/__tests__/outreach-approve.test.ts \
        server/src/deal-desk/tools/__tests__/_helpers.ts
git commit -m "fix(deal-desk): scope outreach approve/reject to URL companyId (C1)"
```

---

### Task 2: C1 (continued) — Tenant-scope outreach edit handler

**Files:**
- Modify: `server/src/deal-desk/tools/outreach-edit.ts` (lines 41-50, 94-102)
- Test: `server/src/deal-desk/tools/__tests__/outreach-edit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { outreachEditHandler } from "../outreach-edit.js";
import { seedTwoCompaniesWithSend } from "./_helpers.js";

describe("outreachEditHandler — tenant isolation (C1)", () => {
  it("returns 404 when URL companyId does not own the send", async () => {
    const { db, companyA, sendIdForB } = await seedTwoCompaniesWithSend();
    const handler = outreachEditHandler({ db });
    const req: any = {
      params: { companyId: companyA, id: sendIdForB },
      body: { subject: "pwned" },
      actor: { type: "board", userId: "00000000-0000-0000-0000-000000000001" },
    };
    let status = 0;
    const res: any = { status(s: number) { status = s; return this; }, json() {} };
    await handler(req, res);
    expect(status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/outreach-edit.test.ts`
Expected: FAIL (status would be 200 — edit succeeds across tenants).

- [ ] **Step 3: Add tenant filter to existing-lookup and to UPDATE**

Replace lines 41-50:
```ts
    const existing = await deps.db
      .select({
        id: ddOutreachSends.id,
        status: ddOutreachSends.status,
        contactId: ddOutreachSends.contactId,
        intermediaryId: ddOutreachSends.intermediaryId,
      })
      .from(ddOutreachSends)
      .where(eq(ddOutreachSends.id, id))
      .limit(1);
```
with:
```ts
    const companyId = req.params.companyId as string;
    const existing = await deps.db
      .select({
        id: ddOutreachSends.id,
        status: ddOutreachSends.status,
        contactId: ddOutreachSends.contactId,
        intermediaryId: ddOutreachSends.intermediaryId,
      })
      .from(ddOutreachSends)
      .where(
        and(
          eq(ddOutreachSends.id, id),
          eq(ddOutreachSends.dealDeskCompanyId, companyId),
        ),
      )
      .limit(1);
```

Replace the final UPDATE block (lines 94-102) with:
```ts
    await deps.db
      .update(ddOutreachSends)
      .set(patch)
      .where(
        and(
          eq(ddOutreachSends.id, id),
          eq(ddOutreachSends.dealDeskCompanyId, companyId),
          eq(ddOutreachSends.status, "awaiting_approval"),
        ),
      );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/outreach-edit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/tools/outreach-edit.ts \
        server/src/deal-desk/tools/__tests__/outreach-edit.test.ts
git commit -m "fix(deal-desk): scope outreach edit to URL companyId (C1)"
```

---

### Task 3: C2 — Tenant-scope `DELETE /email-accounts/:id`

**Why:** `index.ts:148-155` updates `dd_email_accounts` by `id` with no tenant filter. Any logged-in user can revoke any other tenant's Gmail account.

**Files:**
- Modify: `server/src/deal-desk/tools/index.ts` (lines 148-155)
- Test: `server/src/deal-desk/tools/__tests__/email-accounts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest"; // if available in this package — otherwise call the handler directly
import { dealDeskToolsRouter } from "../index.js";
import { seedTwoCompaniesWithEmailAccount } from "./_helpers.js"; // create helper similarly

describe("DELETE /email-accounts/:id — tenant isolation (C2)", () => {
  it("does not revoke an email account owned by another company", async () => {
    const { db, companyA, accountIdForB } = await seedTwoCompaniesWithEmailAccount();
    // Mount router under /:companyId via a minimal Express app, attaching a fake actor for companyA.
    // Assert that DELETE /companies/A/deal-desk/tools/email-accounts/<B-account-id> returns 404
    // AND the underlying row.revokedAt is still null.
    // Implementation detail: follow the mount pattern in deal-desk.ts (assertCompanyAccess gate).
  });
});
```

Use whichever HTTP-testing pattern existing deal-desk tests use; if there isn't one yet, invoke the route handler closure directly with a fake `req`/`res` matching the patterns in Task 1.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/email-accounts.test.ts`
Expected: FAIL — row gets revoked despite tenant mismatch.

- [ ] **Step 3: Add tenant filter to the DELETE handler**

Replace lines 148-155 of `server/src/deal-desk/tools/index.ts`:
```ts
  parent.delete("/email-accounts/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const companyId = req.params.companyId as string;
    const result = await db
      .update(ddEmailAccounts)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(ddEmailAccounts.id, id),
          eq(ddEmailAccounts.dealDeskCompanyId, companyId),
        ),
      )
      .returning({ id: ddEmailAccounts.id });
    if (result.length === 0) {
      res.status(404).json({ ok: false, reason: "Email account not found" });
      return;
    }
    res.status(200).json({ ok: true });
  });
```

Verify `and` is already imported at the top of `index.ts`. If not, add it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/email-accounts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/tools/index.ts \
        server/src/deal-desk/tools/__tests__/email-accounts.test.ts
git commit -m "fix(deal-desk): scope DELETE /email-accounts to URL companyId (C2)"
```

---

### Task 4: C2 (continued) — Tenant-scope `enrich-contact` update

**Why:** `enrich-contact.ts:83-93` looks up and updates `dd_contacts` by `contactId` only. Even though `companyId` arrives via the URL, the contact row isn't required to belong to it. An attacker can spend another tenant's Apollo credits and observe enrichment results for a foreign contact.

**Files:**
- Modify: `server/src/deal-desk/tools/enrich-contact.ts` (line 83-93) plus `resolveContactEmail` call site at 55-60
- Inspect: `server/src/deal-desk/enrichment/resolve-contact-email.ts` — verify whether `resolveContactEmail` and `loadContactForEnrichment` already scope by companyId. If not, add the filter at the helper layer.

- [ ] **Step 1: Inspect helper scoping**

Read `server/src/deal-desk/enrichment/resolve-contact-email.ts`. For each of `loadContactForEnrichment` and `resolveContactEmail`:
- If they take `companyId` and use it in the `where` clause: nothing more to do at the helper level.
- If they don't: add `and(eq(ddContacts.id, contactId), eq(ddContacts.dealDeskCompanyId, companyId))`.

Document what you found in the commit message.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { enrichContactHandler } from "../enrich-contact.js";
import { seedTwoCompaniesWithContact } from "./_helpers.js";

describe("enrichContactHandler — tenant isolation (C2)", () => {
  it("returns 404 when contactId belongs to another company", async () => {
    const { db, companyA, contactIdForB } = await seedTwoCompaniesWithContact();
    const handler = enrichContactHandler({
      db,
      loadApolloKey: async () => "fake-key", // get past the 412 short-circuit
    });
    const req: any = {
      params: { companyId: companyA, contactId: contactIdForB },
      body: {},
      actor: { type: "board", userId: "00000000-0000-0000-0000-000000000001" },
    };
    let status = 0;
    const res: any = { status(s: number) { status = s; return this; }, json() {} };
    await handler(req, res);
    expect(status).toBe(404);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/enrich-contact.test.ts`
Expected: FAIL — handler proceeds to call Apollo or returns 200.

- [ ] **Step 4: Add tenant filter to the contact UPDATE in enrich-contact.ts**

Replace lines 83-93 of `enrich-contact.ts`:
```ts
    const result = await deps.db
      .update(ddContacts)
      .set({
        email: resolved.email,
        emailStatus: resolved.emailStatus,
        source: "apollo",
        enrichedAt: new Date(),
        enrichedByAgentId: resolveEnrichedByAgentId(req),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ddContacts.id, contactId),
          eq(ddContacts.dealDeskCompanyId, companyId),
        ),
      )
      .returning({ id: ddContacts.id });
    if (result.length === 0) {
      res.status(404).json({ ok: false, reason: "Contact not found", code: "contact_not_found" });
      return;
    }
```

Add `and` to the drizzle-orm import on line 3.

Also: if Step 1 found that `resolveContactEmail` does not scope by companyId, fix that helper too (it is the lookup that gates whether the update even runs).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/enrich-contact.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/deal-desk/tools/enrich-contact.ts \
        server/src/deal-desk/enrichment/resolve-contact-email.ts \
        server/src/deal-desk/tools/__tests__/enrich-contact.test.ts
git commit -m "fix(deal-desk): scope enrich-contact update to URL companyId (C2)"
```

---

### Task 5: C3 — Authorize companyId in Gmail OAuth start

**Why:** `app.ts:249-252` reads `?companyId=` from the query string and hands it to `createGmailOAuthRouter` with no `assertCompanyAccess` call. Any authenticated actor can initiate OAuth for any company, and on callback the existing-account branch (`gmail-oauth.ts:102-107`) silently rotates the victim tenant's stored refresh token.

**Files:**
- Modify: `server/src/routes/gmail-oauth.ts` (add an `authorizeCompanyId` callback to `CreateRouterInput`; call it in `/start` and `/callback`)
- Modify: `server/src/app.ts` (lines 243-255) — pass the callback wired to `assertCompanyAccess`
- Test: `server/src/routes/__tests__/gmail-oauth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createGmailOAuthRouter } from "../gmail-oauth.js";
import { forbidden } from "../../errors.js";

describe("createGmailOAuthRouter — start authz (C3)", () => {
  it("refuses to start OAuth for a company the actor cannot access", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: "u1", source: "session", companyIds: ["companyA"] };
      next();
    });
    app.use(
      "/oauth/gmail",
      createGmailOAuthRouter({
        loadClientConfig: async () => ({ clientId: "x", clientSecret: "y" }),
        resolveRedirectUri: () => "https://example.com/cb",
        resolveCompanyId: (req) => (req.query.companyId as string) ?? null,
        authorizeCompanyId: (req, companyId) => {
          if (companyId !== "companyA") throw forbidden("no access");
        },
        deps: { db: null as any },
      }),
    );
    const res = await request(app).get("/oauth/gmail/start?companyId=companyB");
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && pnpm vitest run src/routes/__tests__/gmail-oauth.test.ts`
Expected: FAIL — `authorizeCompanyId` parameter does not exist yet; TypeScript will reject the test or the route will redirect.

- [ ] **Step 3: Add `authorizeCompanyId` to the router contract and call it**

In `server/src/routes/gmail-oauth.ts`:

Update `CreateRouterInput` (lines 17-22):
```ts
export interface CreateRouterInput {
  loadClientConfig: (companyId: string) => Promise<GmailClientConfig | null>;
  resolveRedirectUri: (req: Request) => string;
  resolveCompanyId: (req: Request) => string | null;
  authorizeCompanyId: (req: Request, companyId: string) => void;
  deps: { db: Db };
}
```

In the `/start` handler, immediately after `if (!companyId) { ... }` (after line 32) insert:
```ts
    try {
      input.authorizeCompanyId(req, companyId);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 403;
      res.status(status).json({ ok: false, reason: "forbidden" });
      return;
    }
```

In the `/callback` handler, immediately after the `companyId = state.split(".")[0]!` line (after line 67) insert the same try/catch block. Rationale: state comes from the cookie which is set on `/start`, but defense-in-depth — if the actor on `/callback` is different from the actor on `/start`, refuse.

- [ ] **Step 4: Wire `assertCompanyAccess` in `app.ts`**

In `server/src/app.ts`, replace lines 243-255:
```ts
  api.use(
    "/oauth/gmail",
    createGmailOAuthRouter({
      loadClientConfig: (companyId) =>
        loadGmailOAuthClient({ companyId }, { store: buildOAuthClientStore() }),
      resolveRedirectUri: resolveGmailOAuthRedirectUri,
      resolveCompanyId: (req) =>
        (req.query.companyId as string | undefined) ??
        (req as ExpressRequest & { user?: { companyId?: string } }).user?.companyId ??
        null,
      authorizeCompanyId: (req, companyId) => assertCompanyAccess(req, companyId),
      deps: { db },
    }),
  );
```

Add `assertCompanyAccess` to the imports at the top of `app.ts` if not already imported (check via grep first).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && pnpm vitest run src/routes/__tests__/gmail-oauth.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full server suite**

Run: `cd server && pnpm vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/gmail-oauth.ts \
        server/src/app.ts \
        server/src/routes/__tests__/gmail-oauth.test.ts
git commit -m "fix(deal-desk): enforce companyId authz in Gmail OAuth start (C3)"
```

---

## Phase 2 — MEDIUM (M3 only — see scope note above)

### Task 6: M3 — Whitelist updatable columns in PATCH thesis

**Why:** `routes/deal-desk.ts:175-180` builds the UPDATE set by iterating `Object.entries(req.body)`. Today `updateThesisSchema` (zod) gates which keys can arrive, but the pattern is fragile — adding any sensitive column to the schema (`dealDeskCompanyId`, `createdByUserId`) immediately makes it tenant-overrideable. Whitelist explicitly so the route can't drift.

**Files:**
- Modify: `server/src/routes/deal-desk.ts` (lines 169-200)
- Test: `server/src/routes/__tests__/deal-desk-thesis.test.ts`

- [ ] **Step 1: Find the updateThesisSchema definition**

Run: `grep -n "updateThesisSchema" server/src/routes/deal-desk.ts server/src/**/*.ts` and read the schema. Note exactly which keys it currently exposes — those are the whitelist.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
// Build a request that smuggles `dealDeskCompanyId` past validate(). Easiest: monkey-patch the
// schema in a test fork, or pass a request that bypasses zod and reaches the loop. If
// validate(updateThesisSchema) strips unknown keys via .strict(), the test should assert that the
// thesis row's dealDeskCompanyId is unchanged after PATCH with a forged body. Mirror the
// supertest pattern used in any existing deal-desk route test.
```

The test must assert: after PATCH `/api/companies/A/deal-desk/theses/<id>` with `{ name: "ok", dealDeskCompanyId: "B" }` (using a request shape that bypasses the validate-strip if any), the `dealDeskCompanyId` column on the row equals A.

- [ ] **Step 3: Replace the loop with a whitelist**

In `server/src/routes/deal-desk.ts`, replace lines 174-180:
```ts
      const body = req.body as z.infer<typeof updateThesisSchema>;
      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      const ALLOWED_KEYS = [
        // Fill from updateThesisSchema — e.g. "name", "summary", "criteria", "status", etc.
      ] as const;
      for (const key of ALLOWED_KEYS) {
        const value = (body as Record<string, unknown>)[key];
        if (value !== undefined) {
          updateValues[key] = value;
        }
      }
```

Replace the `ALLOWED_KEYS` array with the actual keys from `updateThesisSchema` discovered in Step 1.

- [ ] **Step 4: Run tests**

Run: `cd server && pnpm vitest run src/routes/__tests__/deal-desk-thesis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/deal-desk.ts \
        server/src/routes/__tests__/deal-desk-thesis.test.ts
git commit -m "fix(deal-desk): whitelist updatable columns in PATCH thesis (M3)"
```

---

## Phase 3 — LOW

### Task 7: L1 — Stop leaking DB error messages from create-target

**Files:**
- Modify: `server/src/deal-desk/tools/create-target.ts` (lines 53-58)

- [ ] **Step 1: Edit the catch block**

Replace lines 53-58:
```ts
    } catch (error) {
      const requestId = (req as Request & { id?: string }).id ?? null;
      console.error("[deal-desk] create-target failed", { requestId, error });
      res.status(500).json({
        ok: false,
        reason: "Internal error creating target",
      });
    }
```

If a logger abstraction already exists in this repo (e.g. `pino`, `bunyan`), use it instead of `console.error`. Quick check: `grep -n "import.*logger\|pino\|bunyan" server/src/deal-desk/tools/create-target.ts server/src/app.ts | head`.

- [ ] **Step 2: Run smoke test**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/create-target.test.ts` (if it exists). Expected: still passes; if any test asserted on the leaked `Database error: ...` substring, update it.

- [ ] **Step 3: Commit**

```bash
git add server/src/deal-desk/tools/create-target.ts
git commit -m "fix(deal-desk): redact DB error details from create-target response (L1)"
```

---

### Task 8: L2 — Force OAuth state cookie `secure` outside development

**Files:**
- Modify: `server/src/routes/gmail-oauth.ts` (line 48)

- [ ] **Step 1: Edit the cookie call**

Replace line 48:
```ts
      secure: process.env.NODE_ENV === "production" || redirectUri.startsWith("https://"),
```

Rationale: in production we always want `secure: true` regardless of how `redirectUri` is built; in dev (`NODE_ENV !== "production"`), keep the HTTPS-derived fallback so local `http://localhost` still works.

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/gmail-oauth.ts
git commit -m "fix(deal-desk): always set OAuth state cookie secure in production (L2)"
```

---

### Task 9: L3 — Reject agent actors on outreach approve

**Why:** The review flagged that `outreachApproveHandler` reads `req.actor.userId` for the `approvedByUserId` field but does not reject agent-typed actors. A compromised agent token shouldn't be allowed to approve its own drafts — only board (human) actors should approve sends.

**Files:**
- Modify: `server/src/deal-desk/tools/outreach-approve.ts` (top of the returned handler, around line 51)

- [ ] **Step 1: Add an actor-type guard**

In the function returned by `outreachApproveHandler`, immediately after the line `const sendId = req.params.id as string;`, insert:
```ts
    if (req.actor.type !== "board") {
      res.status(403).json({ ok: false, reason: "Only human users can approve outreach sends" });
      return;
    }
```

- [ ] **Step 2: Update the approve test from Task 1**

Add a case that posts as `{ actor: { type: "agent", agentId: "a1", companyId: companyA } }` and expects 403.

- [ ] **Step 3: Run tests**

Run: `cd server && pnpm vitest run src/deal-desk/tools/__tests__/outreach-approve.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/deal-desk/tools/outreach-approve.ts \
        server/src/deal-desk/tools/__tests__/outreach-approve.test.ts
git commit -m "fix(deal-desk): only board actors may approve outreach sends (L3)"
```

---

## Final Verification

- [ ] **Run the full server test suite**

Run: `cd server && pnpm vitest run`
Expected: all tests pass.

- [ ] **Run any cli tests that touched files indirectly**

Run: `cd cli && pnpm vitest run`
Expected: all tests pass (no changes here, but a sanity check).

- [ ] **Manual smoke test in browser (if dev server is set up)**

1. Start the stack: follow the README dev instructions for `paperclip`.
2. Log in as user-in-company-A.
3. Try `curl -b cookies.txt "$BASE/api/oauth/gmail/start?companyId=<company-B-id>"` → expect 403.
4. Approve an outreach send that belongs to a different company-B id under the company-A URL → expect 404.

- [ ] **Open follow-up tracking issues**

Recommend the user open issues for:
- **H1** Email header CRLF injection in `gmail/send.ts` (HIGH, exploitable).
- **H2** Host-header-derived `redirect_uri` in OAuth (HIGH).
- **M1** Rate limiting for Apollo enrichment, Gmail send, test-gmail-send.
- **M2** CSRF posture audit across `/api/companies/*` mutating routes.

These were intentionally out of scope for this plan but should not ship without resolution.

---

## Self-Review Notes

- **Spec coverage:** C1 → Tasks 1+2. C2 → Tasks 3+4. C3 → Task 5. M3 → Task 6. L1/L2/L3 → Tasks 7/8/9. H1, H2, M1, M2 explicitly excluded with rationale in scope note + final verification step.
- **Placeholder scan:** Task 6 Step 3 has a placeholder `ALLOWED_KEYS` array — this is unavoidable without reading `updateThesisSchema`. Step 1 of that task is the read; the executor fills the array from what they find. Acceptable because the action is narrowly scoped ("copy the schema keys here").
- **Type consistency:** `and`/`eq` imports from `drizzle-orm`, `assertCompanyAccess` from `routes/authz.js`, schema names (`ddOutreachSends`, `ddContacts`, `ddEmailAccounts`, `ddTheses`, columns including `dealDeskCompanyId`) all match what was observed in the source files.
