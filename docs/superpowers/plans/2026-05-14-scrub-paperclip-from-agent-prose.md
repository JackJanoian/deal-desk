# Scrub "Paperclip" from Agent-Visible Prose

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Deal Desk agents from referring to the platform as "Paperclip" by scrubbing the word from every piece of text the LLM actually reads (system prompts, skill bodies, prose in reference files).

**Architecture:** The LLM-visible surfaces for a Deal Desk agent are: (1) the `systemPrompt` from `dd_role_templates` (seeded by `server/src/deal-desk/seeds/role-templates.ts`), (2) the `AGENTS.md` the user attached at hire time, and (3) any synced skill files under `skills/paperclip*/` whose content gets injected. We rewrite the prose in those files to say "Deal Desk" instead of "Paperclip". We deliberately do NOT rename:
- Skill directory names or `slug:` frontmatter values (`paperclip`, `paperclip-create-agent`, …) — the upstream sync code and `desiredSkills` registry are keyed on these strings.
- Wire-format identifiers (`X-Paperclip-Run-Id` header, `npx paperclipai` CLI bin, `paperclip_managed` secret mode, `paperclipCompanyId` DB column, `@paperclipai/db` package import) — those are real protocol/identifier strings; renaming docs would break the agent's API instructions and renaming code is a much larger refactor out of scope here.

**Tech Stack:** TypeScript, markdown, Drizzle-seeded role templates, vitest.

---

## File Structure

**Modify (prose-only, no logic):**
- `server/src/deal-desk/seeds/role-templates.ts` — rewrite `dealDeskSkillGuidance` to drop skill-name references that contain "paperclip"
- `skills/paperclip/SKILL.md` — strip "Paperclip" from body prose
- `skills/paperclip-create-agent/SKILL.md` — strip "Paperclip" from body prose; also clean the example skill-name listings so the LLM doesn't echo the word
- `skills/paperclip/references/workflows.md` — scrub prose mentions; leave CLI commands and HTTP header names intact
- `skills/paperclip/references/routines.md` — scrub prose; leave HMAC header names intact
- `skills/paperclip/references/issue-workspaces.md` — scrub prose; leave `X-Paperclip-Run-Id` and `paperclip*` MCP tool names intact (those are wire format)
- `skills/paperclip/references/company-skills.md` — scrub the one prose mention
- `skills/paperclip/references/api-reference.md` — scrub prose mentions only; leave header names, env var names, and example payload data alone
- `ui/src/pages/deal-desk/QuickHire.tsx:116-119` — replace the stale `// DEAL DESK: v0.3.1 — Paperclip rejects…` comment with a neutral phrasing so future LLM passes don't pick it up if the file is fed in as context (low priority, but free)

**Verify / re-seed:**
- The seeder upserts on each server start, so restarting the server is enough to push the rewritten prompts into `dd_role_templates`. Existing agents already hired retain their original `instructionsBundle` (from the user's `.md`) and are not affected by re-seeding role templates — only future hires get the new wording.

**Out of scope (deliberately not touched):**
- `packages/db/src/schema/deal_desk.ts` — column `paperclipCompanyId`
- `packages/shared/src/constants.ts:454` — `SECRET_MANAGED_MODES = ["paperclip_managed", …]`
- `ui/src/pages/deal-desk/QuickHire.tsx:16-22` — `DEAL_DESK_SKILL_KEYS` array (the slugs must match the on-disk skill directory names that Paperclip's sync layer uses to resolve skills)
- All `import … from "@paperclipai/db"` imports
- FORK.md, FORK_REPORT.md, README.md, CONTRIBUTING.md, AGENTS.md, ROADMAP.md, CODEBASE_NOTES.md — repository documentation, not LLM-visible during a Deal Desk hire
- Storybook fixtures and stories
- `skills/terminal-bench-loop/` and `skills/diagnose-why-work-stopped/` — not in `DEAL_DESK_SKILL_KEYS`, not synced to Deal Desk agents
- `skills/paperclip-converting-plans-to-tasks/SKILL.md`, `skills/paperclip-create-plugin/SKILL.md`, `skills/paperclip-dev/SKILL.md` — `grep` confirms the only mention of "paperclip" in each is the `slug:` line, which we are keeping

---

## Task 1: Rewrite role-template system prompts

**Files:**
- Modify: `server/src/deal-desk/seeds/role-templates.ts:16-25`

- [ ] **Step 1: Open the seed file and locate the `dealDeskSkillGuidance` constant**

The current value names `paperclip*` skills directly inside the prompt body, so every hired agent's system prompt contains the word "paperclip" five times.

- [ ] **Step 2: Replace the guidance string and the helper**

Replace lines 16-25 of `server/src/deal-desk/seeds/role-templates.ts` with this exact block:

```ts
const dealDeskSkillGuidance =
  "Use the Deal Desk skills attached to this employee as your operating playbook. " +
  "They cover target, contact, intermediary, and pipeline workflow; decomposing a " +
  "thesis or coverage plan into tickets; recommending or drafting new Deal Desk " +
  "hires; integration and tooling work; and Deal Desk app development. " +
  "Always refer to the platform as 'Deal Desk' in conversation with the user — " +
  "never use any other product name.";

function withDealDeskSkills(prompt: string): string {
  return `${prompt} ${dealDeskSkillGuidance}`;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Stage**

```bash
git add server/src/deal-desk/seeds/role-templates.ts
```

(Do not commit yet — orchestrator batches commits.)

---

## Task 2: Scrub `skills/paperclip/SKILL.md`

**Files:**
- Modify: `skills/paperclip/SKILL.md:18`

- [ ] **Step 1: Open the file and find line 18**

Current line 18:

```
Use this skill for Deal Desk domain work. It replaces the old platform-control-plane workflow for these agents. Do not use Paperclip-specific runtime tools or bundled platform skills unless a user explicitly asks for platform maintenance.
```

- [ ] **Step 2: Replace line 18**

Use `Edit` to replace that exact line with:

```
Use this skill for Deal Desk domain work. It replaces the old platform-control-plane workflow for these agents. Do not use platform-maintenance runtime tools or bundled platform skills unless a user explicitly asks for platform maintenance.
```

- [ ] **Step 3: Sanity-check**

Run: `grep -n "[Pp]aperclip" skills/paperclip/SKILL.md`
Expected: only the `slug: paperclip` line on line 2 remains. No other matches.

- [ ] **Step 4: Stage**

```bash
git add skills/paperclip/SKILL.md
```

---

## Task 3: Scrub `skills/paperclip-create-agent/SKILL.md`

**Files:**
- Modify: `skills/paperclip-create-agent/SKILL.md`

- [ ] **Step 1: Inspect current Paperclip mentions**

Run: `grep -n "[Pp]aperclip" skills/paperclip-create-agent/SKILL.md`

Expected matches at minimum: `slug: paperclip-create-agent`, the "Default Skill Set" bullet list (lines 23-27), and the example JSON skill list (lines 86-90). The slug must stay (frontmatter, line 2). The body bullets / example JSON list skill slugs that the user-facing prose still calls out — leave the *list* but change any surrounding prose that says the word "Paperclip" as a product name. Skill slugs are identifiers and stay.

- [ ] **Step 2: Search the body for the word "Paperclip" (capital P) standalone**

Run: `grep -n "Paperclip" skills/paperclip-create-agent/SKILL.md`

For each prose match (NOT slug list entries, NOT frontmatter), replace "Paperclip" → "Deal Desk". For slug list lines (lines that look like `- \`paperclip\`` or `"paperclip"`), leave them unchanged — they are identifier strings.

- [ ] **Step 3: Final scan**

Run: `grep -n "Paperclip" skills/paperclip-create-agent/SKILL.md`
Expected: zero results (only lower-case `paperclip*` slug identifiers remain).

- [ ] **Step 4: Stage**

```bash
git add skills/paperclip-create-agent/SKILL.md
```

---

## Task 4: Scrub `skills/paperclip/references/workflows.md`

**Files:**
- Modify: `skills/paperclip/references/workflows.md`

- [ ] **Step 1: Survey**

Run: `grep -n "[Pp]aperclip" skills/paperclip/references/workflows.md`

Categorize each hit:
- Title `# Paperclip Workflow Playbooks` — **rewrite** to `# Deal Desk Workflow Playbooks`
- Prose sentences mentioning "Paperclip" — **rewrite** to "Deal Desk"
- CLI commands like `npx paperclipai issue create …` — **leave**; that is the actual binary name
- Env vars like `$PAPERCLIP_AGENT_ID` — **leave**; real env var names
- HTTP headers like `X-Paperclip-Run-Id` — **leave**; real header names

- [ ] **Step 2: Apply edits**

For each line that contains prose using the word "Paperclip" as a product name (e.g. `# Paperclip Workflow Playbooks`, `Use this when validating Paperclip itself …`, `Paperclip copies active user memberships …`, `If you use direct curl during these tests, include X-Paperclip-Run-Id …` — the last one keeps the header name but rewrites the surrounding prose), use the `Edit` tool to swap the product-name use of "Paperclip" for "Deal Desk".

Concretely (lines from current grep output):
- Line 1 `# Paperclip Workflow Playbooks` → `# Deal Desk Workflow Playbooks`
- Line 92 `… Paperclip copies active user memberships from the source company …` → `… Deal Desk copies active user memberships from the source company …`
- Line 108 `Use this when validating Paperclip itself …` → `Use this when validating Deal Desk itself …`
- Line 141 `If you use direct curl during these tests, include X-Paperclip-Run-Id on all mutating issue requests whenever running inside a heartbeat.` — leave intact; the only Paperclip token here is the literal header name `X-Paperclip-Run-Id`, which is a wire-format identifier.

CLI lines 113, 124, 130, 136 (`npx paperclipai …`) — **leave**.

- [ ] **Step 3: Verify**

Run: `grep -n "Paperclip" skills/paperclip/references/workflows.md`
Expected: zero results.
Run: `grep -n "paperclip" skills/paperclip/references/workflows.md`
Expected: only `paperclipai` (CLI), `X-Paperclip` (header — wait that's capital P; the grep above already covers it, so this should show only `paperclipai` CLI invocations). Lowercase `paperclipai` is the binary; keep.

- [ ] **Step 4: Stage**

```bash
git add skills/paperclip/references/workflows.md
```

---

## Task 5: Scrub `skills/paperclip/references/routines.md`

**Files:**
- Modify: `skills/paperclip/references/routines.md`

- [ ] **Step 1: Survey**

Run: `grep -n "Paperclip" skills/paperclip/references/routines.md`

Known hits:
- Line 1 `# Paperclip Routines` → `# Deal Desk Routines`
- Line 121 `HMAC: X-Paperclip-Signature + X-Paperclip-Timestamp headers` → **leave** (header names are wire format)
- Line 187 `Use the generic API endpoint tables in skills/paperclip/references/api-reference.md …` → **leave** (file path identifier)

- [ ] **Step 2: Apply the line-1 rewrite using Edit**

Old: `# Paperclip Routines`
New: `# Deal Desk Routines`

- [ ] **Step 3: Verify**

Run: `grep -n "Paperclip" skills/paperclip/references/routines.md`
Expected: only the two intentional wire-format / file-path lines remain (121, 187).

- [ ] **Step 4: Stage**

```bash
git add skills/paperclip/references/routines.md
```

---

## Task 6: Scrub `skills/paperclip/references/issue-workspaces.md`

**Files:**
- Modify: `skills/paperclip/references/issue-workspaces.md`

- [ ] **Step 1: Survey**

Run: `grep -n "Paperclip" skills/paperclip/references/issue-workspaces.md`

Categorize:
- Line 21 `… so Paperclip preserves workspace continuity.` — prose, **rewrite** to `… so Deal Desk preserves workspace continuity.`
- Line 25 `Prefer Paperclip-managed runtime service controls over manual pnpm dev …` — prose, **rewrite** to `Prefer platform-managed runtime service controls over manual pnpm dev …`
- Lines 31, 39, 47 `-H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \` — **leave** (header + env var)
- Line 74 `When the Paperclip MCP tools are available, prefer these issue-scoped tools:` — prose, **rewrite** to `When the Deal Desk MCP tools are available, prefer these issue-scoped tools:`
- Lines 76, 77, 78 `paperclipGetIssueWorkspaceRuntime`, `paperclipControlIssueWorkspaceServices`, `paperclipWaitForIssueWorkspaceService` — **leave** (real MCP tool names)

- [ ] **Step 2: Apply edits**

Use `Edit` for the three prose-only rewrites identified above.

- [ ] **Step 3: Verify**

Run: `grep -n "Paperclip" skills/paperclip/references/issue-workspaces.md`
Expected: only lines 31, 39, 47, 76, 77, 78 remain.

- [ ] **Step 4: Stage**

```bash
git add skills/paperclip/references/issue-workspaces.md
```

---

## Task 7: Scrub `skills/paperclip/references/company-skills.md`

**Files:**
- Modify: `skills/paperclip/references/company-skills.md`

- [ ] **Step 1: Survey**

Run: `grep -n "Paperclip" skills/paperclip/references/company-skills.md`

Known hits:
- Line 185 `Agents only receive company skills that are explicitly selected; bundled Paperclip runtime tools are not added automatically.` — prose, **rewrite** to `Agents only receive company skills that are explicitly selected; bundled platform runtime tools are not added automatically.`
- All other Paperclip mentions in this file are `$PAPERCLIP_API_URL`, `$PAPERCLIP_API_KEY`, `$PAPERCLIP_COMPANY_ID` env vars — **leave** (real env vars).

- [ ] **Step 2: Apply the line-185 rewrite**

Old: `- Agents only receive company skills that are explicitly selected; bundled Paperclip runtime tools are not added automatically.`
New: `- Agents only receive company skills that are explicitly selected; bundled platform runtime tools are not added automatically.`

- [ ] **Step 3: Verify**

Run: `grep -n "Paperclip" skills/paperclip/references/company-skills.md`
Expected: only env-var lines remain (`$PAPERCLIP_*`).

- [ ] **Step 4: Stage**

```bash
git add skills/paperclip/references/company-skills.md
```

---

## Task 8: Scrub `skills/paperclip/references/api-reference.md`

**Files:**
- Modify: `skills/paperclip/references/api-reference.md`

- [ ] **Step 1: Survey**

Run: `grep -n "Paperclip" skills/paperclip/references/api-reference.md`

Apply this rule per match:
- Line 1 `# Paperclip API Reference` → `# Deal Desk API Reference`
- Line 3 `Detailed reference for the Paperclip control plane API. …` → `Detailed reference for the Deal Desk control plane API. …`
- Line 102 `"skills/paperclip/SKILL.md"` — **leave** (file path identifier inside a JSON example)
- Line 244 `… Paperclip records the decision row automatically.` → `… Deal Desk records the decision row automatically.`
- Line 343 `Paperclip writes the execution decision automatically. …` → `Deal Desk writes the execution decision automatically. …`
- Line 352 `Paperclip converts that into a changes_requested decision …` → `Deal Desk converts that into a changes_requested decision …`
- Line 391 `# ^ Load tests depend on caching layer being done first. Paperclip will auto-wake agent-55 when the blocker resolves.` → `# ^ Load tests depend on caching layer being done first. Deal Desk will auto-wake agent-55 when the blocker resolves.`
- Line 564 `"name": "Paperclip Mobile App",` and Line 583 `"name": "Paperclip Mobile App",` — these are example payload company names — **leave** (illustrative data, not product self-reference). Optional: rewrite to `"Acme Mobile App"` for extra cleanliness. Recommend: **do** rewrite to `"Acme Mobile App"` since the LLM may quote them. Apply: replace both occurrences.
- Lines 569, 570, 571, 590, 591 (`paperclip-mobile`, `/Users/me/paperclip-mobile`, `github.com/acme/paperclip-mobile`) — example slugs/paths in fixture data. Rewrite to `acme-mobile`, `/Users/me/acme-mobile`, `github.com/acme/acme-mobile` for the same reason.
- Line 629 `Use paperclip-create-agent for the full hiring workflow …` — **leave** (skill-slug identifier, lowercase)
- Line 739 `… so Paperclip can wake the blocked assignee when all blockers resolve.` → `… so Deal Desk can wake the blocked assignee when all blockers resolve.`
- Line 899 (table cell) `… Set blockedByIssueIds so Paperclip auto-wakes the assignee when all blockers are done` → `… Set blockedByIssueIds so Deal Desk auto-wakes the assignee when all blockers are done`

- [ ] **Step 2: Apply each rewrite using `Edit`**

For each line above, use `Edit` with the exact `old_string` from the file and the `new_string` from the rule above. If `old_string` is not unique, include 1–2 lines of surrounding context to disambiguate.

- [ ] **Step 3: Verify**

Run: `grep -n "Paperclip" skills/paperclip/references/api-reference.md`
Expected: zero capital-P matches remain.
Run: `grep -n "paperclip" skills/paperclip/references/api-reference.md`
Expected: only the lowercase identifier slugs `paperclip*` (skill slugs, file paths under `skills/paperclip/`). No `paperclip-mobile` strings should remain.

- [ ] **Step 4: Stage**

```bash
git add skills/paperclip/references/api-reference.md
```

---

## Task 9: Update the stale code comment in QuickHire

**Files:**
- Modify: `ui/src/pages/deal-desk/QuickHire.tsx:116-119`

This comment is internal documentation and is not loaded into the LLM at runtime, but it shows up in `grep` and looks inconsistent after the scrub. Drive-by cleanup.

- [ ] **Step 1: Open and locate**

Lines 116-119 currently read:

```tsx
      // DEAL DESK: v0.3.1 — Paperclip rejects adapterConfig.promptTemplate for new
      // agents on adapters that support instructions bundles (server/src/routes/agents.ts
      // assertNoNewAgentLegacyPromptTemplate). Send the prompt via the top-level
      // instructionsBundle instead.
```

- [ ] **Step 2: Replace with**

```tsx
      // DEAL DESK: v0.3.1 — the server rejects adapterConfig.promptTemplate for new
      // agents on adapters that support instructions bundles (see
      // server/src/routes/agents.ts assertNoNewAgentLegacyPromptTemplate). Send the
      // prompt via the top-level instructionsBundle instead.
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Stage**

```bash
git add ui/src/pages/deal-desk/QuickHire.tsx
```

---

## Task 10: Final verification + commit

**Files:** none (verification only)

- [ ] **Step 1: Confirm no agent-visible prose still says "Paperclip"**

Run:

```bash
grep -rn "Paperclip" \
  server/src/deal-desk/seeds/role-templates.ts \
  skills/paperclip/SKILL.md \
  skills/paperclip-create-agent/SKILL.md \
  skills/paperclip/references/
```

Expected: every remaining match is one of:
- A `slug:` frontmatter line (`slug: paperclip`, `slug: paperclip-create-agent`, …)
- A wire-format identifier (`X-Paperclip-Run-Id`, `X-Paperclip-Signature`, `X-Paperclip-Timestamp`)
- A real env var name (`$PAPERCLIP_API_URL`, `$PAPERCLIP_API_KEY`, `$PAPERCLIP_COMPANY_ID`, `$PAPERCLIP_AGENT_ID`, `$PAPERCLIP_RUN_ID`, `$PAPERCLIPAI_CMD`)
- A CLI binary name (`paperclipai`)
- An MCP tool identifier (`paperclipGetIssueWorkspaceRuntime`, `paperclipControlIssueWorkspaceServices`, `paperclipWaitForIssueWorkspaceService`)
- A file path inside `skills/paperclip/` (e.g. `"skills/paperclip/SKILL.md"`)

If any prose sentence still contains the word "Paperclip" as a product name, fix it now and re-stage.

- [ ] **Step 2: Typecheck the full repo**

Run: `pnpm typecheck`
Expected: exit 0. (Markdown edits don't affect typecheck, but the role-template + QuickHire edits do.)

- [ ] **Step 3: Run targeted tests**

Run: `pnpm --filter @paperclipai/server test -- deal-desk-tools.test.ts` if available, otherwise:

```bash
pnpm --filter @paperclipai/server test
```

Expected: pass. The seed/role-template change is a string-content change; tests do not snapshot the prompt text.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(deal-desk): scrub Paperclip from agent-visible prose

Deal Desk agents were referring to the platform as 'Paperclip' in chat
because the seeded role-template system prompts and synced skill files
literally contained the word. This rewrites the LLM-visible prose to
say 'Deal Desk' instead.

Out of scope (kept verbatim): skill slugs, HTTP header names, env var
names, CLI bin names, MCP tool names, DB column names, and the
@paperclipai/db package import — those are wire-format identifiers and
renaming them would break the control plane.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Manual UAT note**

The seeder upserts `dd_role_templates` rows by slug on server startup. After this commit, restart the dev server (`pnpm dev`) once so the new prompt strings land in the DB. Existing agents already hired still carry their original `instructionsBundle` from the user's uploaded `.md` and are not retroactively updated — that is the intended behavior (a hire is a snapshot, not a live link).

For agents already hired that the user finds quoting "Paperclip", the only fix is to re-hire them or edit their `instructionsBundle` directly via the Agent edit UI.

---

## Self-review

**Spec coverage:** The user reported agents saying "in Paperclip". Every LLM-visible surface that could leak the word is covered:
- Role-template `systemPrompt` (Task 1)
- The five skills listed in `DEAL_DESK_SKILL_KEYS` — `paperclip` (Task 2 + Tasks 4-8 for its references), `paperclip-create-agent` (Task 3), and `paperclip-converting-plans-to-tasks` / `paperclip-create-plugin` / `paperclip-dev` (verified empty by grep — only the `slug:` frontmatter line matches, which we keep intentionally).

**Placeholder scan:** Each Edit step provides exact old/new text or, where text is too long to inline, a precise rule (line number + product-name-only substitution + explicit "leave" list). No "TBD" or "handle edge cases".

**Type consistency:** Only one code change (Task 1) has typed impact; the `dealDeskSkillGuidance` constant keeps the same `string` type and the `withDealDeskSkills` helper keeps the same signature.

**One thing the plan deliberately does NOT do:** rename the skill directories or `slug:` frontmatter values. That would require coordinated changes in `ui/src/pages/deal-desk/QuickHire.tsx:16-22`, the company-skill sync code on the server, any DB rows in `company_skills` referencing the old slugs, and every test fixture in `server/src/__tests__/` and `ui/src/lib/` that hard-codes `"paperclip"`. That's a v0.4+ migration, not a prose scrub.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-scrub-paperclip-from-agent-prose.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
