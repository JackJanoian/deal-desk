# QuickHire instructionsBundle Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `QuickHire` from getting "New agents must use instructionsBundle/AGENTS.md instead of adapterConfig.promptTemplate" by sending the instructions as a top-level `instructionsBundle`, not `adapterConfig.promptTemplate`.

**Architecture:** Single change in `ui/src/pages/deal-desk/QuickHire.tsx`. Paperclip rejects `adapterConfig.promptTemplate` for new agents whose adapter supports instructions bundles (see `server/src/routes/agents.ts:1132`). The accepted shape is a sibling field: `instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": "<prompt text>" } }`. The schema lives at `packages/shared/src/validators/agent.ts:47-52` (`createAgentInstructionsBundleSchema`).

**Tech Stack:** React + TypeScript strict, agentsApi (Express), zod (server-side), vitest.

---

## File Structure

**Modify:**
- `ui/src/pages/deal-desk/QuickHire.tsx` — switch the payload from `adapterConfig.promptTemplate` → top-level `instructionsBundle`

**(Optional, follow-up):**
- A second small task to also fix the v0.2 `NewAgent` prefill effect at `ui/src/pages/NewAgent.tsx:140-150`, which writes `configValues.promptTemplate` from the Deal Desk role template. That path doesn't hit the create endpoint directly (the user submits the form, and `NewAgent` already handles the bundle for new agents through `AgentConfigForm`), but the prefill into `configValues.promptTemplate` is now dead weight when a fresh agent is created. **Out of scope for this plan — left as a v0.4 cleanup.**

---

## Task 1: Send `instructionsBundle` instead of `adapterConfig.promptTemplate`

**Files:**
- Modify: `ui/src/pages/deal-desk/QuickHire.tsx` (the `createAgent` mutation body)

- [ ] **Step 1: Read the current mutation body**

Open `ui/src/pages/deal-desk/QuickHire.tsx`. Find the `createAgent = useMutation({ mutationFn: ... })` block. It currently does roughly:

```tsx
return agentsApi.create(selectedCompanyId, {
  name: name.trim(),
  title: title.trim() || name.trim(),
  role: "general",
  adapterType: "claude_local",
  adapterConfig: {
    promptTemplate: systemPrompt,
    dangerouslySkipPermissions: true,
  },
  budgetMonthlyCents,
});
```

- [ ] **Step 2: Rewrite the mutation body**

Replace the body above with this exact code:

```tsx
// DEAL DESK: v0.3.1 — Paperclip rejects adapterConfig.promptTemplate for new
// agents on adapters that support instructions bundles (server/src/routes/agents.ts
// assertNoNewAgentLegacyPromptTemplate). Send the prompt via the top-level
// instructionsBundle instead.
return agentsApi.create(selectedCompanyId, {
  name: name.trim(),
  title: title.trim() || name.trim(),
  role: "general",
  adapterType: "claude_local",
  adapterConfig: {
    dangerouslySkipPermissions: true,
  },
  instructionsBundle: {
    entryFile: "AGENTS.md",
    files: {
      "AGENTS.md": systemPrompt,
    },
  },
  budgetMonthlyCents,
});
```

- [ ] **Step 3: Guard against empty systemPrompt at submit time**

Empty content in `instructionsBundle.files["AGENTS.md"]` is technically valid per the schema (the refinement only requires `Object.keys(files).length > 0`), but the agent won't have useful instructions. The existing `submitDisabled` check already requires `systemPrompt.trim()` to be non-empty, so no additional guard is needed.

Verify the guard line still reads:

```tsx
const submitDisabled =
  !name.trim() || !systemPrompt.trim() || createAgent.isPending || !selectedCompanyId;
```

If it doesn't, restore it.

- [ ] **Step 4: Typecheck**

```bash
cd "/Users/jackjanoian/Deal Desk/paperclip"
pnpm typecheck
```

Expected: exit 0. The `agentsApi.create` payload type is `Record<string, unknown>` so the new keys typecheck without further changes.

- [ ] **Step 5: Smoke-test against the dev server**

```bash
pnpm dev
```

Open the app, navigate to `/deal-desk/hire`, click "Hire" on the Head of BD template, and submit the form. Expected: the toast reads "Employee hired" and the page navigates to `/agents`. The previous error ("New agents must use instructionsBundle/AGENTS.md...") should not appear.

Repeat for the "Create custom employee" card — confirm that flow also succeeds.

- [ ] **Step 6: Commit**

```bash
git add ui/src/pages/deal-desk/QuickHire.tsx
git commit -m "fix(deal-desk): QuickHire sends instructionsBundle, not promptTemplate

Paperclip rejects adapterConfig.promptTemplate for new agents on
adapters that support instructions bundles (claude_local does).
QuickHire was hitting the unprocessable() guard at
server/src/routes/agents.ts:1132 with:
  'New agents must use instructionsBundle/AGENTS.md instead of
   adapterConfig.promptTemplate or bootstrapPromptTemplate'

Fix: send the prompt at the top level as
  instructionsBundle: { entryFile: 'AGENTS.md', files: { 'AGENTS.md': prompt } }
and drop promptTemplate from adapterConfig.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage:** The user's reported error is the exact string thrown by `assertNoNewAgentLegacyPromptTemplate` at `server/src/routes/agents.ts:1132`. Task 1 removes `promptTemplate` from `adapterConfig` and adds the schema-compliant `instructionsBundle`. No other path in QuickHire writes `promptTemplate`, so the change is sufficient.

**Placeholder scan:** None. Every step has the exact code or command.

**Type consistency:** `entryFile: "AGENTS.md"` matches the default the server uses at `server/src/routes/agents.ts:1115`. The `files` map key matches the entry file. `createAgentInstructionsBundleSchema` accepts both fields as defined.

**One thing the plan deliberately does NOT do:** update `NewAgent.tsx`'s Deal Desk prefill effect (`setConfigValues((prev) => ({ ...prev, promptTemplate: ... }))`). That effect only seeds the form state — `AgentConfigForm` and the rest of NewAgent already convert prompt text into the bundle before submitting, so it still works. If a v0.4 cleanup removes the `promptTemplate` field altogether from `CreateConfigValues`, that prefill code becomes dead and should be removed then.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-quickhire-instructions-bundle-fix.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
