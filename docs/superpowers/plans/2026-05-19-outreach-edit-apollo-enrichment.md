# Outreach Edit-Before-Approve + Apollo.io Contact Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let humans edit outreach drafts inline before approving, and replace LLM-guessed contact emails with verified Apollo.io lookups via a per-company BYO API key.

**Architecture:** Two largely independent slices that ship together. (A) Adds a `PATCH /outreach/sends/:id` endpoint plus inline subject/body editing on `OutreachApprovals.tsx`, with audit columns `editedAt`/`editedByUserId` on `dd_outreach_sends`. (B) Adds a per-company `apollo.api_key` secret (mirroring the Gmail OAuth client wizard), an `ApolloClient` HTTP wrapper around `POST /api/v1/people/match`, and rewires the existing `enrichContact` tool to call Apollo when configured, falling back to the current behavior when not.

**Tech Stack:** TypeScript, Express, React + Vite, Drizzle ORM (Postgres), Vitest + supertest, `@testing-library/react` + jsdom, `secretService` with `local_encrypted` provider, Apollo.io REST API.

---

## File Structure

**Part A — Edit-before-approve:**

- Modify: `packages/db/src/schema/deal_desk.ts` — add `editedAt`, `editedByUserId` columns to `dd_outreach_sends`.
- Create: `packages/db/migrations/0089_dd_outreach_sends_edit_audit.sql` — additive migration.
- Create: `server/src/deal-desk/tools/outreach-edit.ts` — `outreachEditHandler({ db })` for `PATCH /outreach/sends/:id`.
- Create: `server/src/deal-desk/tools/__tests__/outreach-edit.test.ts` — supertest coverage.
- Modify: `server/src/deal-desk/tools/index.ts` — mount the PATCH route.
- Modify: `ui/src/pages/deal-desk/OutreachApprovals.tsx` — inline editable subject/body + Save button.
- Create: `ui/src/pages/deal-desk/__tests__/OutreachApprovals.edit.test.tsx` — UI test for edit flow.

**Part B — Apollo.io enrichment:**

- Create: `server/src/deal-desk/enrichment/apollo-config.ts` — `saveApolloApiKey`, `loadApolloApiKey`, `deleteApolloApiKey` (mirrors `gmail/client-config.ts`).
- Create: `server/src/deal-desk/enrichment/apollo-client.ts` — `apolloMatchPerson({ firstName, lastName, companyDomain, apiKey })` HTTP wrapper.
- Create: `server/src/deal-desk/enrichment/__tests__/apollo-client.test.ts` — fetch-mocked tests.
- Create: `server/src/deal-desk/tools/apollo-api-key.ts` — `GET/POST/DELETE /apollo-api-key` route handlers.
- Create: `server/src/deal-desk/tools/__tests__/apollo-api-key.test.ts` — supertest coverage.
- Modify: `server/src/deal-desk/tools/index.ts` — mount the Apollo config routes; provide `loadApolloApiKey` to `enrich-contact.ts`.
- Modify: `server/src/deal-desk/tools/enrich-contact.ts` — call Apollo when key is configured, populate `dd_contacts` with email + source.
- Modify: `ui/src/pages/deal-desk/EmailAccounts.tsx` — render `<ApolloSetupSection />` beneath Gmail wizard.
- Create: `ui/src/pages/deal-desk/ApolloSetupSection.tsx` — small card: shows "Configured" + Reset, or shows API key input.
- Create: `ui/src/pages/deal-desk/__tests__/ApolloSetupSection.test.tsx` — UI test for configured/unconfigured states.

---

## Part A: Edit-Before-Approve

### Task 1: Add edit-audit columns to `dd_outreach_sends`

**Files:**
- Modify: `packages/db/src/schema/deal_desk.ts:242-276`
- Create: `packages/db/migrations/0089_dd_outreach_sends_edit_audit.sql`

- [ ] **Step 1: Inspect existing schema for `dd_outreach_sends`**

Run: `grep -n "ddOutreachSends" packages/db/src/schema/deal_desk.ts | head`
Expected: shows the table definition near line 242.

- [ ] **Step 2: Add the two columns to the Drizzle schema**

In `packages/db/src/schema/deal_desk.ts`, inside the `ddOutreachSends = pgTable("dd_outreach_sends", { ... })` block, add (immediately after the existing `approvedByUserId` column):

```typescript
  editedAt: timestamp("edited_at", { withTimezone: true }),
  editedByUserId: uuid("edited_by_user_id"),
```

(Keep ordering: status/timestamps/audit cluster together.)

- [ ] **Step 3: Write the SQL migration**

Create `packages/db/migrations/0089_dd_outreach_sends_edit_audit.sql`:

```sql
-- DEAL DESK: human edits to agent-drafted outreach sends
ALTER TABLE dd_outreach_sends
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by_user_id uuid;
```

- [ ] **Step 4: Run migration against the local dev DB**

Run: `pnpm --filter @dealdesk/db migrate`
Expected: migration `0089_dd_outreach_sends_edit_audit` applied; no errors.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @dealdesk/db typecheck && pnpm --filter @dealdesk/server typecheck`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/deal_desk.ts packages/db/migrations/0089_dd_outreach_sends_edit_audit.sql
git commit -m "feat(deal-desk): add edit audit columns to dd_outreach_sends"
```

---

### Task 2: Implement `PATCH /outreach/sends/:id` handler

**Files:**
- Create: `server/src/deal-desk/tools/outreach-edit.ts`
- Test: `server/src/deal-desk/tools/__tests__/outreach-edit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/deal-desk/tools/__tests__/outreach-edit.test.ts`:

```typescript
import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { outreachEditHandler } from "../outreach-edit.js";

function makeApp(deps: Parameters<typeof outreachEditHandler>[0]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).userId = "user-1";
    next();
  });
  app.patch("/sends/:id", outreachEditHandler(deps));
  return app;
}

describe("PATCH /outreach/sends/:id", () => {
  let updateSet: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  let selectLimit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    selectLimit = vi.fn().mockResolvedValue([
      { id: "send-1", status: "awaiting_approval" },
    ]);
    updateSet = vi.fn().mockReturnThis();
    updateWhere = vi.fn().mockResolvedValue([{ id: "send-1" }]);
  });

  const db = (): any => ({
    select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
    update: () => ({ set: updateSet, where: updateWhere }),
  });

  it("rejects when status is not awaiting_approval", async () => {
    selectLimit = vi.fn().mockResolvedValue([{ id: "send-1", status: "sent" }]);
    const app = makeApp({ db: db() });
    const res = await request(app)
      .patch("/sends/send-1")
      .send({ subject: "Hi" });
    expect(res.status).toBe(409);
    expect(res.body.reason).toMatch(/awaiting_approval/);
  });

  it("returns 404 when send not found", async () => {
    selectLimit = vi.fn().mockResolvedValue([]);
    const app = makeApp({ db: db() });
    const res = await request(app).patch("/sends/missing").send({ subject: "Hi" });
    expect(res.status).toBe(404);
  });

  it("updates subject + body and writes audit fields", async () => {
    updateSet = vi.fn().mockImplementation((patch) => {
      expect(patch.subject).toBe("New subject");
      expect(patch.body).toBe("New body");
      expect(patch.editedByUserId).toBe("user-1");
      expect(patch.editedAt).toBeInstanceOf(Date);
      return { where: updateWhere };
    });
    const app = makeApp({ db: db() });
    const res = await request(app)
      .patch("/sends/send-1")
      .send({ subject: "New subject", body: "New body" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects empty body when both fields missing", async () => {
    const app = makeApp({ db: db() });
    const res = await request(app).patch("/sends/send-1").send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test (should fail with import error)**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/tools/__tests__/outreach-edit.test.ts`
Expected: FAIL with `Cannot find module '../outreach-edit.js'`.

- [ ] **Step 3: Write the handler**

Create `server/src/deal-desk/tools/outreach-edit.ts`:

```typescript
import type { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ddOutreachSends } from "@dealdesk/db";
import type { Db } from "@dealdesk/db";

const bodySchema = z
  .object({
    subject: z.string().min(1).max(998).optional(),
    body: z.string().min(1).max(50_000).optional(),
  })
  .refine((v) => v.subject !== undefined || v.body !== undefined, {
    message: "must provide subject or body",
  });

export function outreachEditHandler(deps: { db: Db }): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ ok: false, reason: parse.error.message });
      return;
    }
    const id = req.params.id;
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      res.status(401).json({ ok: false, reason: "auth required" });
      return;
    }

    const existing = await deps.db
      .select({ id: ddOutreachSends.id, status: ddOutreachSends.status })
      .from(ddOutreachSends)
      .where(eq(ddOutreachSends.id, id))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ ok: false, reason: "send not found" });
      return;
    }
    if (existing[0].status !== "awaiting_approval") {
      res.status(409).json({
        ok: false,
        reason: `can only edit sends in awaiting_approval status (current: ${existing[0].status})`,
      });
      return;
    }

    const patch: Record<string, unknown> = {
      editedAt: new Date(),
      editedByUserId: userId,
    };
    if (parse.data.subject !== undefined) patch.subject = parse.data.subject;
    if (parse.data.body !== undefined) patch.body = parse.data.body;

    await deps.db
      .update(ddOutreachSends)
      .set(patch)
      .where(and(eq(ddOutreachSends.id, id), eq(ddOutreachSends.status, "awaiting_approval")));

    res.status(200).json({ ok: true });
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/tools/__tests__/outreach-edit.test.ts`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Mount the route**

In `server/src/deal-desk/tools/index.ts`, find the line near 180-206 where `parent.post("/outreach/sends/:id/approve", ...)` is registered. Immediately above (or below) it, add:

```typescript
parent.patch("/outreach/sends/:id", outreachEditHandler({ db: deps.db }));
```

Add the import at the top:

```typescript
import { outreachEditHandler } from "./outreach-edit.js";
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @dealdesk/server typecheck`
Expected: zero errors.

```bash
git add server/src/deal-desk/tools/outreach-edit.ts \
        server/src/deal-desk/tools/__tests__/outreach-edit.test.ts \
        server/src/deal-desk/tools/index.ts
git commit -m "feat(deal-desk): PATCH /outreach/sends/:id endpoint for human edits"
```

---

### Task 3: Inline edit UI on `OutreachApprovals.tsx`

**Files:**
- Modify: `ui/src/pages/deal-desk/OutreachApprovals.tsx`
- Test: `ui/src/pages/deal-desk/__tests__/OutreachApprovals.edit.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui/src/pages/deal-desk/__tests__/OutreachApprovals.edit.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import OutreachApprovalsPage from "../OutreachApprovals";

vi.mock("../../../hooks/useCompany", () => ({
  useCompany: () => ({ id: "company-1", issuePrefix: "PAP" }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        sends: [
          {
            id: "send-1",
            subject: "Hello {{firstName}}",
            body: "Original body",
            contactEmail: "alice@acme.com",
            contactName: "Alice",
            status: "awaiting_approval",
          },
        ],
      }),
    } as Response;
  });
});

describe("OutreachApprovals edit flow", () => {
  it("lets the user edit subject and body and PATCHes the server", async () => {
    render(
      <MemoryRouter>
        <OutreachApprovalsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const subjectInput = screen.getByLabelText(/subject/i) as HTMLInputElement;
    const bodyInput = screen.getByLabelText(/body/i) as HTMLTextAreaElement;
    fireEvent.change(subjectInput, { target: { value: "Updated subject" } });
    fireEvent.change(bodyInput, { target: { value: "Updated body" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body).toEqual({ subject: "Updated subject", body: "Updated body" });
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @dealdesk/ui vitest run src/pages/deal-desk/__tests__/OutreachApprovals.edit.test.tsx`
Expected: FAIL — no `Edit` button found.

- [ ] **Step 3: Modify the page to support inline edit**

In `ui/src/pages/deal-desk/OutreachApprovals.tsx`, add (1) edit state per row, (2) editable inputs, (3) Save handler. Replace the per-row card render with:

```tsx
function PendingSendCard({
  send,
  companyId,
  onChanged,
}: {
  send: PendingSend;
  companyId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(send.subject);
  const [body, setBody] = useState(send.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${send.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ subject, body }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      setEditing(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-sm text-neutral-600">
        To: <strong>{send.contactName ?? send.contactEmail}</strong>{" "}
        &lt;{send.contactEmail}&gt;
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-neutral-500">
            Subject
            <input
              aria-label="subject"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="block text-xs text-neutral-500">
            Body
            <textarea
              aria-label="body"
              className="mt-1 h-40 w-full rounded border border-neutral-300 px-2 py-1 text-sm font-mono"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setSubject(send.subject);
                setBody(send.body);
              }}
              className="rounded border border-neutral-300 px-3 py-1 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="font-medium">{send.subject}</div>
          <pre className="whitespace-pre-wrap text-sm text-neutral-800">{send.body}</pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-neutral-300 px-3 py-1 text-sm"
            >
              Edit
            </button>
            <ApproveButton sendId={send.id} companyId={companyId} onDone={onChanged} />
            <RejectButton sendId={send.id} companyId={companyId} onDone={onChanged} />
          </div>
        </div>
      )}
    </div>
  );
}
```

Wire the page-level renderer to use `<PendingSendCard />` instead of the previous inline JSX. Keep the existing `ApproveButton`/`RejectButton` components if they exist; otherwise inline equivalent buttons that POST to `.../approve` and `.../reject`. Update the `PendingSend` type if needed:

```tsx
type PendingSend = {
  id: string;
  subject: string;
  body: string;
  contactEmail: string;
  contactName: string | null;
  status: string;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @dealdesk/ui vitest run src/pages/deal-desk/__tests__/OutreachApprovals.edit.test.tsx`
Expected: PASS — 1/1 test.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @dealdesk/ui typecheck`
Expected: zero errors.

```bash
git add ui/src/pages/deal-desk/OutreachApprovals.tsx \
        ui/src/pages/deal-desk/__tests__/OutreachApprovals.edit.test.tsx
git commit -m "feat(deal-desk): inline edit for pending outreach sends"
```

---

### Task 4: Manual smoke — edit + approve a real send

- [ ] **Step 1: Start dev server, navigate to `/PAP/deal-desk/outreach/approvals`**

Run: `pnpm dev` (in repo root)
Open: `http://localhost:5173/PAP/deal-desk/outreach/approvals` (replace `PAP` with your `issuePrefix`).

- [ ] **Step 2: Confirm there is at least one `awaiting_approval` send**

If none exist, queue one via the existing Outreach Analyst flow or insert directly:

```sql
INSERT INTO dd_outreach_sends (id, deal_desk_company_id, contact_id, subject, body, status)
VALUES (gen_random_uuid(), '<your-company-id>', '<some-contact-id>', 'Smoke subject', 'Smoke body', 'awaiting_approval');
```

- [ ] **Step 3: Click Edit, change subject + body, click Save**

Expected: row re-renders with new subject/body, no error.

- [ ] **Step 4: Verify DB**

Run:
```bash
psql "$DATABASE_URL" -c \
  "select subject, body, edited_at, edited_by_user_id from dd_outreach_sends order by edited_at desc nulls last limit 1;"
```
Expected: shows your edited values plus a non-null `edited_at` + `edited_by_user_id`.

- [ ] **Step 5: Click Approve**

Expected: send transitions to `sent`, recipient inbox receives the *edited* subject/body (not the agent's original).

---

## Part B: Apollo.io Contact Enrichment

### Task 5: Apollo API key config module

**Files:**
- Create: `server/src/deal-desk/enrichment/apollo-config.ts`
- Test: `server/src/deal-desk/enrichment/__tests__/apollo-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/deal-desk/enrichment/__tests__/apollo-config.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  saveApolloApiKey,
  loadApolloApiKey,
  deleteApolloApiKey,
  APOLLO_API_KEY_SECRET_KEY,
  type ApolloConfigStore,
} from "../apollo-config.js";

function makeStore(initial: Record<string, { id: string; value: string }> = {}): ApolloConfigStore {
  const byKey = new Map(Object.entries(initial));
  return {
    async getByKey(_companyId, key) {
      const v = byKey.get(key);
      return v ? { id: v.id } : null;
    },
    async create(companyId, args) {
      const id = `secret-${byKey.size + 1}`;
      byKey.set(args.key, { id, value: args.value });
      return { id };
    },
    async replace(secretId, args) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) {
          byKey.set(k, { ...v, value: args.value });
          return;
        }
      }
      throw new Error("secret not found");
    },
    async remove(secretId) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) {
          byKey.delete(k);
          return;
        }
      }
    },
    async load(companyId, secretId) {
      for (const v of byKey.values()) {
        if (v.id === secretId) return v.value;
      }
      return null;
    },
  };
}

describe("apollo-config", () => {
  it("creates the secret on first save and rotates on subsequent save", async () => {
    const store = makeStore();
    await saveApolloApiKey({ companyId: "c1", apiKey: "key-aaa" }, { store });
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBe("key-aaa");

    await saveApolloApiKey({ companyId: "c1", apiKey: "key-bbb" }, { store });
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBe("key-bbb");
  });

  it("loadApolloApiKey returns null when not configured", async () => {
    const store = makeStore();
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBeNull();
  });

  it("deleteApolloApiKey removes the secret", async () => {
    const store = makeStore();
    await saveApolloApiKey({ companyId: "c1", apiKey: "key-aaa" }, { store });
    await deleteApolloApiKey({ companyId: "c1" }, { store });
    expect(await loadApolloApiKey({ companyId: "c1" }, { store })).toBeNull();
  });

  it("uses the documented secret key", () => {
    expect(APOLLO_API_KEY_SECRET_KEY).toBe("apollo.api_key");
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/enrichment/__tests__/apollo-config.test.ts`
Expected: FAIL — `Cannot find module '../apollo-config.js'`.

- [ ] **Step 3: Implement the module**

Create `server/src/deal-desk/enrichment/apollo-config.ts`:

```typescript
export const APOLLO_API_KEY_SECRET_KEY = "apollo.api_key" as const;

export interface ApolloConfigStore {
  getByKey(companyId: string, key: string): Promise<{ id: string } | null>;
  create(
    companyId: string,
    args: { name: string; key: string; value: string; description?: string },
  ): Promise<{ id: string }>;
  replace(secretId: string, args: { value: string }): Promise<void>;
  remove(secretId: string): Promise<void>;
  load(companyId: string, secretId: string): Promise<string | null>;
}

export async function saveApolloApiKey(
  args: { companyId: string; apiKey: string },
  ctx: { store: ApolloConfigStore },
): Promise<void> {
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_API_KEY_SECRET_KEY);
  if (existing) {
    await ctx.store.replace(existing.id, { value: args.apiKey });
    return;
  }
  await ctx.store.create(args.companyId, {
    name: "Apollo.io API Key",
    key: APOLLO_API_KEY_SECRET_KEY,
    value: args.apiKey,
    description: "Apollo.io API key for contact enrichment",
  });
}

export async function loadApolloApiKey(
  args: { companyId: string },
  ctx: { store: ApolloConfigStore },
): Promise<string | null> {
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_API_KEY_SECRET_KEY);
  if (!existing) return null;
  return ctx.store.load(args.companyId, existing.id);
}

export async function deleteApolloApiKey(
  args: { companyId: string },
  ctx: { store: ApolloConfigStore },
): Promise<void> {
  const existing = await ctx.store.getByKey(args.companyId, APOLLO_API_KEY_SECRET_KEY);
  if (!existing) return;
  await ctx.store.remove(existing.id);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/enrichment/__tests__/apollo-config.test.ts`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/enrichment/apollo-config.ts \
        server/src/deal-desk/enrichment/__tests__/apollo-config.test.ts
git commit -m "feat(deal-desk): per-company Apollo API key storage"
```

---

### Task 6: Apollo HTTP client (`apolloMatchPerson`)

**Files:**
- Create: `server/src/deal-desk/enrichment/apollo-client.ts`
- Test: `server/src/deal-desk/enrichment/__tests__/apollo-client.test.ts`

Reference: Apollo `POST /api/v1/people/match` — request: `{ first_name, last_name, organization_name | domain, api_key }` (api_key may also be sent as `X-Api-Key` header). Response includes `person.email`, `person.email_status` (`"verified" | "unverified" | "guessed" | "bounced"`).

- [ ] **Step 1: Write the failing test**

Create `server/src/deal-desk/enrichment/__tests__/apollo-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apolloMatchPerson } from "../apollo-client.js";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("apolloMatchPerson", () => {
  it("posts to people/match with the right body and headers", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        person: { email: "a@b.com", email_status: "verified" },
      }),
    });
    const r = await apolloMatchPerson({
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
      apiKey: "key-xyz",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.apollo.io/api/v1/people/match");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Api-Key": "key-xyz",
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      first_name: "Alice",
      last_name: "Smith",
      domain: "acme.com",
      reveal_personal_emails: false,
    });
    expect(r).toEqual({ email: "a@b.com", emailStatus: "verified" });
  });

  it("returns null email when person not found", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ person: null }),
    });
    const r = await apolloMatchPerson({
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
      apiKey: "key-xyz",
    });
    expect(r).toEqual({ email: null, emailStatus: null });
  });

  it("maps email_status 'guessed' to 'unverified'", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        person: { email: "a@b.com", email_status: "guessed" },
      }),
    });
    const r = await apolloMatchPerson({
      firstName: "A",
      lastName: "B",
      companyDomain: "x.com",
      apiKey: "k",
    });
    expect(r.emailStatus).toBe("unverified");
  });

  it("throws on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    await expect(
      apolloMatchPerson({
        firstName: "A",
        lastName: "B",
        companyDomain: "x.com",
        apiKey: "bad",
      }),
    ).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/enrichment/__tests__/apollo-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client**

Create `server/src/deal-desk/enrichment/apollo-client.ts`:

```typescript
export type ApolloEmailStatus = "verified" | "unverified" | "bounced" | "invalid";

export interface ApolloMatchInput {
  firstName: string;
  lastName: string;
  companyDomain: string;
  apiKey: string;
}

export interface ApolloMatchResult {
  email: string | null;
  emailStatus: ApolloEmailStatus | null;
}

const APOLLO_ENDPOINT = "https://api.apollo.io/api/v1/people/match";

function normalizeStatus(raw: unknown): ApolloEmailStatus | null {
  if (raw === "verified") return "verified";
  if (raw === "bounced") return "bounced";
  if (raw === "invalid") return "invalid";
  if (raw === "guessed" || raw === "unverified") return "unverified";
  return null;
}

export async function apolloMatchPerson(input: ApolloMatchInput): Promise<ApolloMatchResult> {
  const res = await fetch(APOLLO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": input.apiKey,
    },
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      domain: input.companyDomain,
      reveal_personal_emails: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo people/match failed (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as { person?: { email?: string; email_status?: string } | null };
  const person = payload.person ?? null;
  if (!person || !person.email) {
    return { email: null, emailStatus: null };
  }
  return {
    email: person.email,
    emailStatus: normalizeStatus(person.email_status),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/enrichment/__tests__/apollo-client.test.ts`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/deal-desk/enrichment/apollo-client.ts \
        server/src/deal-desk/enrichment/__tests__/apollo-client.test.ts
git commit -m "feat(deal-desk): Apollo.io people/match HTTP client"
```

---

### Task 7: Apollo API key route handlers (`GET/POST/DELETE /apollo-api-key`)

**Files:**
- Create: `server/src/deal-desk/tools/apollo-api-key.ts`
- Test: `server/src/deal-desk/tools/__tests__/apollo-api-key.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/deal-desk/tools/__tests__/apollo-api-key.test.ts`:

```typescript
import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import {
  apolloApiKeyGetHandler,
  apolloApiKeyPostHandler,
  apolloApiKeyDeleteHandler,
} from "../apollo-api-key.js";
import type { ApolloConfigStore } from "../../enrichment/apollo-config.js";

function makeInMemoryStore(): ApolloConfigStore {
  const byKey = new Map<string, { id: string; value: string }>();
  let n = 0;
  return {
    async getByKey(_c, k) {
      const v = byKey.get(k);
      return v ? { id: v.id } : null;
    },
    async create(_c, args) {
      n += 1;
      const id = `s-${n}`;
      byKey.set(args.key, { id, value: args.value });
      return { id };
    },
    async replace(secretId, args) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) byKey.set(k, { ...v, value: args.value });
      }
    },
    async remove(secretId) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) byKey.delete(k);
      }
    },
    async load(_c, secretId) {
      for (const v of byKey.values()) if (v.id === secretId) return v.value;
      return null;
    },
  };
}

function makeApp(store: ApolloConfigStore) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).companyId = "c1";
    next();
  });
  app.get("/apollo", apolloApiKeyGetHandler({ store }));
  app.post("/apollo", apolloApiKeyPostHandler({ store }));
  app.delete("/apollo", apolloApiKeyDeleteHandler({ store }));
  return app;
}

describe("apollo-api-key handlers", () => {
  let store: ApolloConfigStore;
  beforeEach(() => {
    store = makeInMemoryStore();
  });

  it("GET returns configured=false initially", async () => {
    const res = await request(makeApp(store)).get("/apollo");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false });
  });

  it("POST saves the key, GET then shows configured=true", async () => {
    const app = makeApp(store);
    const post = await request(app).post("/apollo").send({ apiKey: "key-12345678" });
    expect(post.status).toBe(200);
    expect(post.body.ok).toBe(true);
    const get = await request(app).get("/apollo");
    expect(get.body.configured).toBe(true);
  });

  it("POST rejects short keys", async () => {
    const res = await request(makeApp(store)).post("/apollo").send({ apiKey: "x" });
    expect(res.status).toBe(400);
  });

  it("DELETE removes the key", async () => {
    const app = makeApp(store);
    await request(app).post("/apollo").send({ apiKey: "key-12345678" });
    const del = await request(app).delete("/apollo");
    expect(del.status).toBe(200);
    const get = await request(app).get("/apollo");
    expect(get.body.configured).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/tools/__tests__/apollo-api-key.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handlers**

Create `server/src/deal-desk/tools/apollo-api-key.ts`:

```typescript
import type { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import {
  saveApolloApiKey,
  loadApolloApiKey,
  deleteApolloApiKey,
  type ApolloConfigStore,
} from "../enrichment/apollo-config.js";

const postSchema = z.object({
  apiKey: z.string().min(8).max(256),
});

function readCompanyId(req: Request): string | null {
  const id = (req as Request & { companyId?: string }).companyId;
  return id ?? null;
}

export function apolloApiKeyGetHandler(deps: { store: ApolloConfigStore }): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const companyId = readCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    const key = await loadApolloApiKey({ companyId }, { store: deps.store });
    res.json({ configured: !!key });
  };
}

export function apolloApiKeyPostHandler(deps: { store: ApolloConfigStore }): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const companyId = readCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    const parse = postSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ ok: false, reason: parse.error.message });
      return;
    }
    await saveApolloApiKey(
      { companyId, apiKey: parse.data.apiKey },
      { store: deps.store },
    );
    res.json({ ok: true });
  };
}

export function apolloApiKeyDeleteHandler(deps: { store: ApolloConfigStore }): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const companyId = readCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    await deleteApolloApiKey({ companyId }, { store: deps.store });
    res.json({ ok: true });
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/tools/__tests__/apollo-api-key.test.ts`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Mount the routes**

In `server/src/deal-desk/tools/index.ts`, near the existing Gmail client config mount (around lines 205-207), add:

```typescript
import {
  apolloApiKeyGetHandler,
  apolloApiKeyPostHandler,
  apolloApiKeyDeleteHandler,
} from "./apollo-api-key.js";
import type { ApolloConfigStore } from "../enrichment/apollo-config.js";

function buildApolloConfigStore(db: Db): ApolloConfigStore {
  const svc = secretService(db);
  return {
    async getByKey(companyId, key) {
      const rows = await db
        .select({ id: companySecrets.id })
        .from(companySecrets)
        .where(
          and(
            eq(companySecrets.dealDeskCompanyId, companyId),
            eq(companySecrets.key, key),
            ne(companySecrets.status, "deleted"),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },
    async create(companyId, args) {
      return svc.create(companyId, { ...args, provider: "local_encrypted" });
    },
    async replace(secretId, args) {
      await svc.rotate(secretId, { value: args.value });
    },
    async remove(secretId) {
      await svc.remove(secretId);
    },
    async load(companyId, secretId) {
      return svc.resolveSecretValue(companyId, secretId, "latest");
    },
  };
}
```

Then mount:

```typescript
const apolloStore = buildApolloConfigStore(deps.db);
parent.get("/apollo-api-key", apolloApiKeyGetHandler({ store: apolloStore }));
parent.post("/apollo-api-key", apolloApiKeyPostHandler({ store: apolloStore }));
parent.delete("/apollo-api-key", apolloApiKeyDeleteHandler({ store: apolloStore }));
```

(If `companySecrets`, `ne`, `and`, `eq`, `secretService` aren't already imported in `tools/index.ts`, add them — the existing `buildClientConfigStore` function near line 144 will already import most of them; reuse the same import block.)

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @dealdesk/server typecheck`
Expected: zero errors.

```bash
git add server/src/deal-desk/tools/apollo-api-key.ts \
        server/src/deal-desk/tools/__tests__/apollo-api-key.test.ts \
        server/src/deal-desk/tools/index.ts
git commit -m "feat(deal-desk): GET/POST/DELETE /apollo-api-key endpoints"
```

---

### Task 8: Rewire `enrich-contact.ts` to call Apollo

**Files:**
- Modify: `server/src/deal-desk/tools/enrich-contact.ts`
- Test: `server/src/deal-desk/tools/__tests__/enrich-contact.test.ts`

The current file (lines 1-37) returns "not configured". We replace its body so that when an Apollo key is configured, we call `apolloMatchPerson` and update the `dd_contacts` row.

- [ ] **Step 1: Write the failing test**

Create `server/src/deal-desk/tools/__tests__/enrich-contact.test.ts`:

```typescript
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichContactHandler } from "../enrich-contact.js";

const apolloMock = vi.fn();
vi.mock("../../enrichment/apollo-client.js", () => ({
  apolloMatchPerson: (...args: unknown[]) => apolloMock(...args),
}));

function makeApp(deps: Parameters<typeof enrichContactHandler>[0]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).companyId = "c1";
    next();
  });
  app.post("/enrich/:contactId", enrichContactHandler(deps));
  return app;
}

describe("enrich-contact handler", () => {
  let updateSet: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  let contactRow: { id: string; firstName: string | null; lastName: string | null; companyDomain: string | null };

  beforeEach(() => {
    apolloMock.mockReset();
    contactRow = {
      id: "contact-1",
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
    };
    updateSet = vi.fn().mockReturnThis();
    updateWhere = vi.fn().mockResolvedValue([{ id: "contact-1" }]);
  });

  const db = (): any => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([contactRow]) }) }),
    }),
    update: () => ({ set: updateSet, where: updateWhere }),
  });

  it("returns 412 when no Apollo key configured", async () => {
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => null,
    });
    const res = await request(app).post("/enrich/contact-1").send({});
    expect(res.status).toBe(412);
    expect(res.body.reason).toMatch(/apollo/i);
  });

  it("calls Apollo and updates the contact when key is configured", async () => {
    apolloMock.mockResolvedValueOnce({ email: "alice@acme.com", emailStatus: "verified" });
    updateSet.mockImplementationOnce((patch: Record<string, unknown>) => {
      expect(patch.email).toBe("alice@acme.com");
      expect(patch.emailStatus).toBe("verified");
      expect(patch.source).toBe("apollo");
      expect(patch.enrichedAt).toBeInstanceOf(Date);
      return { where: updateWhere };
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/enrich/contact-1").send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, email: "alice@acme.com", emailStatus: "verified" });
  });

  it("returns 404 when contact missing", async () => {
    contactRow = null as unknown as typeof contactRow;
    const app = makeApp({
      db: { select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }) } as any,
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/enrich/missing").send({});
    expect(res.status).toBe(404);
  });

  it("returns ok:false when Apollo finds no email", async () => {
    apolloMock.mockResolvedValueOnce({ email: null, emailStatus: null });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/enrich/contact-1").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, reason: "no email found" });
  });

  it("returns 422 when contact missing firstName/lastName/domain", async () => {
    contactRow = { id: "contact-1", firstName: null, lastName: "Smith", companyDomain: "acme.com" };
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/enrich/contact-1").send({});
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/tools/__tests__/enrich-contact.test.ts`
Expected: FAIL — handler signature mismatch (current export doesn't take `loadApolloKey`).

- [ ] **Step 3: Verify the contact schema has `companyDomain` (or equivalent)**

Run: `grep -n "companyDomain\|company_domain\|domain" packages/db/src/schema/deal_desk.ts | head -20`

If `companyDomain` doesn't exist on `dd_contacts`, find the equivalent column (likely `companyId` → join to `dd_targets.domain`, or a denormalized `domain`/`companyDomain` field). Adjust the schema-read in the handler accordingly. **Do not** add a new column for this — use what the table already exposes for the company's domain.

- [ ] **Step 4: Rewrite the handler**

Replace `server/src/deal-desk/tools/enrich-contact.ts` with:

```typescript
import type { Request, Response, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { ddContacts } from "@dealdesk/db";
import type { Db } from "@dealdesk/db";
import { apolloMatchPerson } from "../enrichment/apollo-client.js";

export interface EnrichContactDeps {
  db: Db;
  loadApolloKey: (companyId: string) => Promise<string | null>;
}

function readCompanyId(req: Request): string | null {
  return (req as Request & { companyId?: string }).companyId ?? null;
}

export function enrichContactHandler(deps: EnrichContactDeps): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const companyId = readCompanyId(req);
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }
    const apiKey = await deps.loadApolloKey(companyId);
    if (!apiKey) {
      res.status(412).json({
        ok: false,
        reason:
          "Apollo.io API key not configured for this company. " +
          "Visit /deal-desk/email-accounts to set it up.",
      });
      return;
    }

    const contactId = req.params.contactId;
    const rows = await deps.db
      .select({
        id: ddContacts.id,
        firstName: ddContacts.firstName,
        lastName: ddContacts.lastName,
        companyDomain: ddContacts.companyDomain,
      })
      .from(ddContacts)
      .where(eq(ddContacts.id, contactId))
      .limit(1);
    const contact = rows[0];
    if (!contact) {
      res.status(404).json({ ok: false, reason: "contact not found" });
      return;
    }
    if (!contact.firstName || !contact.lastName || !contact.companyDomain) {
      res.status(422).json({
        ok: false,
        reason: "contact missing firstName, lastName, or companyDomain",
      });
      return;
    }

    const match = await apolloMatchPerson({
      firstName: contact.firstName,
      lastName: contact.lastName,
      companyDomain: contact.companyDomain,
      apiKey,
    });
    if (!match.email) {
      res.status(200).json({ ok: false, reason: "no email found" });
      return;
    }

    await deps.db
      .update(ddContacts)
      .set({
        email: match.email,
        emailStatus: match.emailStatus ?? "unverified",
        source: "apollo",
        enrichedAt: new Date(),
      })
      .where(eq(ddContacts.id, contactId));

    res.status(200).json({
      ok: true,
      email: match.email,
      emailStatus: match.emailStatus,
    });
  };
}
```

**Note:** If the actual `dd_contacts` column is named differently than `companyDomain` (e.g., the contact references a target via `targetId` and the domain lives on `dd_targets.domain`), adjust the `select`/`update` to join through and read from the right column. The handler logic stays the same.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @dealdesk/server vitest run src/deal-desk/tools/__tests__/enrich-contact.test.ts`
Expected: PASS — 5/5 tests.

- [ ] **Step 6: Wire the handler at the route mount**

In `server/src/deal-desk/tools/index.ts`, find where `enrichContact` is currently mounted (was `parent.post("/enrich-contact/:contactId", ...)` or similar). Update the mount to pass the new dep:

```typescript
parent.post(
  "/enrich-contact/:contactId",
  enrichContactHandler({
    db: deps.db,
    loadApolloKey: (companyId) =>
      loadApolloApiKey({ companyId }, { store: apolloStore }),
  }),
);
```

Make sure `loadApolloApiKey` is imported:

```typescript
import { loadApolloApiKey } from "../enrichment/apollo-config.js";
```

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm --filter @dealdesk/server typecheck`
Expected: zero errors.

```bash
git add server/src/deal-desk/tools/enrich-contact.ts \
        server/src/deal-desk/tools/__tests__/enrich-contact.test.ts \
        server/src/deal-desk/tools/index.ts
git commit -m "feat(deal-desk): wire Apollo into enrich-contact handler"
```

---

### Task 9: Apollo setup card on Email Accounts page

**Files:**
- Create: `ui/src/pages/deal-desk/ApolloSetupSection.tsx`
- Test: `ui/src/pages/deal-desk/__tests__/ApolloSetupSection.test.tsx`
- Modify: `ui/src/pages/deal-desk/EmailAccounts.tsx`

- [ ] **Step 1: Write the failing test**

Create `ui/src/pages/deal-desk/__tests__/ApolloSetupSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ApolloSetupSection from "../ApolloSetupSection";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("ApolloSetupSection", () => {
  it("renders input when not configured and saves on submit", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: false }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response);

    render(<ApolloSetupSection companyId="c1" />);
    await waitFor(() => screen.getByLabelText(/apollo api key/i));

    fireEvent.change(screen.getByLabelText(/apollo api key/i), {
      target: { value: "my-apollo-key-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
        apiKey: "my-apollo-key-123",
      });
    });
    await waitFor(() => expect(screen.getByText(/configured/i)).toBeInTheDocument());
  });

  it("shows Reset when configured and clears on click", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: false }),
      } as Response);

    render(<ApolloSetupSection companyId="c1" />);
    await waitFor(() => screen.getByText(/configured/i));

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    await waitFor(() => {
      const delCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "DELETE",
      );
      expect(delCall).toBeTruthy();
    });
    await waitFor(() => expect(screen.getByLabelText(/apollo api key/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm --filter @dealdesk/ui vitest run src/pages/deal-desk/__tests__/ApolloSetupSection.test.tsx`
Expected: FAIL — `Cannot find module '../ApolloSetupSection'`.

- [ ] **Step 3: Implement the component**

Create `ui/src/pages/deal-desk/ApolloSetupSection.tsx`:

```tsx
import { useEffect, useState } from "react";

export default function ApolloSetupSection({ companyId }: { companyId: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(
      `/api/companies/${companyId}/deal-desk/tools/apollo-api-key`,
      { credentials: "include" },
    );
    const j = await res.json();
    setConfigured(Boolean(j.configured));
  }

  useEffect(() => {
    void refresh();
  }, [companyId]);

  async function save() {
    if (apiKey.trim().length < 8) {
      setError("API key looks too short");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/apollo-api-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setApiKey("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/apollo-api-key`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Apollo.io contact enrichment</h3>
      <p className="mt-1 text-xs text-neutral-600">
        Used by the Contact Enricher agent to look up verified email addresses
        for target-company contacts. Get an API key at{" "}
        <a className="underline" href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noreferrer">
          app.apollo.io › Settings › Integrations › API
        </a>.
      </p>

      {configured === null ? (
        <div className="mt-3 text-xs text-neutral-500">Loading…</div>
      ) : configured ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
            Configured
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={reset}
            className="rounded border border-neutral-300 px-3 py-1 text-xs"
          >
            Reset
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-neutral-500">
            Apollo API key
            <input
              aria-label="Apollo API key"
              type="password"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @dealdesk/ui vitest run src/pages/deal-desk/__tests__/ApolloSetupSection.test.tsx`
Expected: PASS — 2/2 tests.

- [ ] **Step 5: Mount the section on EmailAccounts.tsx**

In `ui/src/pages/deal-desk/EmailAccounts.tsx`, add the import at the top:

```tsx
import ApolloSetupSection from "./ApolloSetupSection";
```

Then render `<ApolloSetupSection companyId={company.id} />` directly beneath the existing Gmail section (after the wizard / accounts list, before the page closing tag):

```tsx
<div className="mt-6">
  <ApolloSetupSection companyId={company.id} />
</div>
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @dealdesk/ui typecheck`
Expected: zero errors.

```bash
git add ui/src/pages/deal-desk/ApolloSetupSection.tsx \
        ui/src/pages/deal-desk/__tests__/ApolloSetupSection.test.tsx \
        ui/src/pages/deal-desk/EmailAccounts.tsx
git commit -m "feat(deal-desk): Apollo API key setup section on Email Accounts page"
```

---

### Task 10: Manual smoke — configure Apollo, enrich a real contact

- [ ] **Step 1: Start dev server, log in**

Run: `pnpm dev`
Open: `http://localhost:5173/PAP/deal-desk/email-accounts`

- [ ] **Step 2: Paste an Apollo API key and click Save**

Get a key from https://app.apollo.io/#/settings/integrations/api (free tier is fine).
Expected: the section flips to show "Configured" + Reset.

- [ ] **Step 3: Trigger enrichment via DevTools console**

Pick a contact with `firstName`, `lastName`, and a target with a known domain (e.g., insert a contact for a target whose domain is `stripe.com` and name "Patrick Collison"):

```javascript
fetch('/api/companies/PAP/deal-desk/tools/enrich-contact/<CONTACT_ID>', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({}),
}).then(r => r.json()).then(console.log);
```

Replace `PAP` with your issuePrefix and `<CONTACT_ID>` with a real `dd_contacts.id`.

Expected response: `{ ok: true, email: "...", emailStatus: "verified" | "unverified" }`.

- [ ] **Step 4: Verify DB**

```bash
psql "$DATABASE_URL" -c \
  "select id, first_name, last_name, email, email_status, source, enriched_at from dd_contacts where id = '<CONTACT_ID>';"
```
Expected: `email` populated, `source = 'apollo'`, `enriched_at` recent.

- [ ] **Step 5: Verify the Outreach Analyst now uses the enriched email**

Trigger the Outreach Analyst on a target containing that contact. The drafted send's recipient should be the Apollo-verified email (visible on the Outreach Approvals page).

- [ ] **Step 6: Reset path**

Click Reset on the Apollo card. Expected: section returns to API key input, and a subsequent enrichment call returns 412 with "Apollo.io API key not configured…".

---

## Final integration check

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: all tests pass; no regressions.

- [ ] **Step 2: Run typecheck across the workspace**

Run: `pnpm typecheck`
Expected: zero errors.

- [ ] **Step 3: Update CHANGELOG / FORK.md**

Append an entry to `FORK.md` documenting:
- New `PATCH /outreach/sends/:id` endpoint + Edit button.
- New `apollo.api_key` per-company secret, `GET/POST/DELETE /apollo-api-key` endpoints.
- `enrich-contact` now backed by Apollo when key is configured.

- [ ] **Step 4: Commit and open PR**

```bash
git add FORK.md
git commit -m "docs: outreach edit + Apollo enrichment fork notes"
```
