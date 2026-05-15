# Deal Desk Fork Report

**Forked from:** Paperclip @ commit `b947a7d7` (`[codex] Improve local plugin development workflow (#5821)`)
**Branch:** `feat/deal-desk-migration`
**Completed:** 2026-05-13

## Commits (top of `b947a7d7..HEAD`)

```
849f1189 feat(seeds): deal desk PE role templates ...
c6fc9818 feat(server+ui): deal desk fund thesis flow and dashboard pages
29d09dba feat(tools): deal desk PE toolset
39a22ae4 feat(db): add deal desk PE tables via additive migration
57e82c25 feat(brand): rename to deal desk, retheme UI, update onboarding copy
d0cafe5f chore(fork): codebase analysis notes
```

Each phase committed independently after `pnpm typecheck && pnpm test` both
passed (strict gating). Final stat: 50 files changed, ~24,400 insertions /
~480 deletions.

## Modified existing Paperclip files

Every modified line is marked with a `// DEAL DESK:` or `{/* DEAL DESK: */}`
comment so future merges from upstream stay surgical.

| File | Reason |
|---|---|
| `package.json` | Rename to `deal-desk`, add `version`, `description`, `fork:upstream` script |
| `cli/package.json` | Add `dealdesk` bin alias alongside `paperclipai` |
| `README.md` | Replaced with Deal Desk marketing/quickstart |
| `ui/index.html` | Browser title + apple-mobile-web-app-title → Deal Desk; favicon TODO comment |
| `ui/src/index.css` | `--primary` token → teal-600 `oklch(0.55 0.11 184)` |
| `ui/src/App.tsx` | 4 new routes under `:companyPrefix` (Targets, Intermediaries, Thesis, HireRoles) |
| `ui/src/api/index.ts` | Re-export `dealDeskApi` |
| `ui/src/lib/queryKeys.ts` | Add `dealDesk` query key block |
| `ui/src/context/BreadcrumbContext.tsx` | Document title wordmark `Paperclip` → `Deal Desk` |
| `ui/src/components/OnboardingWizard.tsx` | Step union 4→5; new Thesis step + 3 template cards; fund/strategy/analyst copy |
| `ui/src/components/Sidebar.tsx` | "Fund" section label; new "Deal Sourcing" nav section (Targets/Intermediaries/Hire) |
| `ui/src/components/FileTree.tsx` | Frontmatter `project` label → "Thesis" |
| `ui/src/components/IssueColumns.tsx` | Kanban "Project" column label → "Thesis" |
| `ui/src/components/IssueProperties.tsx` | PropertyPicker label "Project" → "Thesis" |
| `ui/src/components/NewGoalDialog.tsx` | Header/placeholder/button → "investment thesis" framing |
| `ui/src/components/NewProjectDialog.tsx` | Header/placeholder/button/error → "thesis" framing |
| `ui/src/pages/Auth.tsx` | Wordmark + sign-in heading → Deal Desk |
| `ui/src/pages/InviteUxLab.tsx` | Preview wordmark + headings |
| `packages/db/src/schema/index.ts` | Re-export new dd_* tables and enums |
| `server/src/index.ts` | Call `seedDealDeskRoleTemplates(db)` after migrations succeed |
| `server/src/app.ts` | Mount `dealDeskRoutes(db)` under `/api/companies` |

No Paperclip database tables, route paths, function signatures, or domain
identifiers were renamed. The fork is purely additive on those surfaces.

## New files/directories

```
packages/db/src/schema/deal_desk.ts                   schema
packages/db/src/migrations/0085_rapid_fantastic_four.sql   manually pruned migration
packages/db/src/migrations/meta/0085_snapshot.json    generated
packages/db/src/deal-desk.test.ts                     migration smoke tests

server/src/routes/deal-desk.ts                        feature router
server/src/deal-desk/tools/index.ts                   tool router factory
server/src/deal-desk/tools/create-target.ts
server/src/deal-desk/tools/list-targets.ts
server/src/deal-desk/tools/create-intermediary.ts
server/src/deal-desk/tools/list-intermediaries.ts
server/src/deal-desk/tools/record-intermediary-touch.ts
server/src/deal-desk/tools/enrich-contact.ts          stub (needs Apollo/Hunter)
server/src/deal-desk/tools/__tests__/deal-desk-tools.test.ts
server/src/deal-desk/seeds/role-templates.ts          4 role templates
server/src/deal-desk/seeds/seed-role-templates.ts     idempotent upsert

ui/src/api/dealDesk.ts                                typed client
ui/src/pages/deal-desk/Targets.tsx
ui/src/pages/deal-desk/Intermediaries.tsx
ui/src/pages/deal-desk/Thesis.tsx
ui/src/pages/deal-desk/HireRoles.tsx

CODEBASE_NOTES.md                                     phase-1 mapping doc
FORK.md                                               (the spec)
```

## Database additions

8 active tables (all prefixed `dd_`) plus 5 enums:

| Table | Purpose |
|---|---|
| `dd_theses` | Investment mandates (sector, geo, revenue, ebitda, ownership prefs, narrative, template slug) |
| `dd_targets` | Sourced acquisition targets, unique by (fund, company name); fit score 0–100 |
| `dd_intermediaries` | Bankers/brokers with cadence tracking |
| `dd_contacts` | People at target companies (verified-email status enum) |
| `dd_outreach_campaigns` | Email sequence definitions (v0.1 schema only) |
| `dd_outreach_sends` | Individual email rows with approval workflow |
| `dd_suppression_list` | Bounced/unsubscribed emails or domains |
| `dd_role_templates` | Pre-built agent role configurations, seeded at startup |

All FKs to Paperclip's own tables (`companies`, `agents`, `issues`) are stored
as bare `uuid` columns named `paperclip_company_id` / `sourced_by_agent_id` /
`source_ticket_id` — **no SQL-level FK constraints** to Paperclip tables. This
keeps the migration additive and merge-safe.

The generated migration was manually pruned to `dd_*` statements only — the
auto-generator picked up unrelated drift from older migration snapshots
(`company_secret_*`, `issue_recovery_actions`, `secret_access_events`) which
already had migrations on disk. Without pruning, running `0085` would have
failed with "table already exists" errors.

## Known issues / TODOs (v0.2)

1. **"Source targets now" button** on Targets page — currently shows an
   alert. Needs wiring to the issues API to create a ticket assigned to
   the Sector Sourcer agent.
2. **Thesis editing** — Edit button on Thesis page is a placeholder.
3. **Hire Roles → NewAgent prefill** — `HireRoles.tsx` lists the 4 role
   templates with full metadata, but clicking "Hire" alerts the template
   payload instead of pre-filling the new-agent form. `NewAgent.tsx` is
   1840 lines of adapter-specific state and a clean prefill path needs a
   focused refactor that was out of scope for v0.1.
4. **Contact enrichment** — `enrichContact` tool returns a configuration
   message until `APOLLO_API_KEY` or `HUNTER_API_KEY` is wired through
   the Paperclip secret system. Tool surface is in place.
5. **Outreach send infrastructure** — schema present (`dd_outreach_*`,
   `dd_suppression_list`), no Gmail OAuth or send logic yet.
6. **Onboarding `initialStep` shift** — `OnboardingWizard` was renumbered
   from 4 steps to 5. Any caller passing `initialStep: 2` now lands on
   the Thesis step instead of the Agent step. None of the routing
   call sites scanned do this explicitly, but flag for QA.
7. **`as any` at seed call site** — `server/src/index.ts` casts `db` when
   calling `seedDealDeskRoleTemplates` because the local `db` binding in
   that scope is untyped. Tighten the binding when comfortable.

## Estimated Claude credits

Not directly tracked. The migration was executed as 7 commit-bounded phases
with two parallelized subagent dispatches (Phases 6+7 dispatched together,
each phase otherwise serial). Realistic budget: ≈3–5 hours of agent time,
matching FORK.md's original estimate.

## Pulling upstream Paperclip updates

```bash
# One-time setup
git remote add upstream-paperclip https://github.com/paperclipai/paperclip.git

# Per-update
pnpm fork:upstream         # runs: git fetch upstream-paperclip && git merge upstream-paperclip/master
```

Conflicts should appear ONLY in files containing `// DEAL DESK:` comments
(those marked modifications) and never in:
- `packages/db/src/migrations/0000_*` through `0084_*` (Paperclip migrations)
- `server/src/adapters/` (untouched)
- `packages/shared/` (untouched)
- existing Paperclip route files (we added new files, didn't modify them)

If conflicts appear outside the marked files, that's a sign Paperclip moved
something we depend on. Fix the fork edge rather than the merge.

## Verification status

- `pnpm typecheck` — clean across all workspaces at HEAD `849f1189`
- `pnpm test` — clean across all workspaces at HEAD `849f1189`
- End-to-end manual flow (FORK.md §9a) — **not run**; orchestrator did not
  launch the embedded dev server interactively. Recommend a manual pass
  through onboarding → org chart → Hire Roles → Targets before
  shipping.
- Upstream merge dry-run (FORK.md §9d) — **not run**; no
  `upstream-paperclip` remote is configured in this clone. After adding
  the remote, run `git merge upstream-paperclip/master --no-commit --no-ff`
  to validate.
