# Deal Desk Fork — Codebase Notes

Reference for migration. Paths absolute from repo root.

## Concept mapping (per FORK.md)

| Paperclip | Deal Desk | Where it lives |
|---|---|---|
| Company | Fund | `packages/db/src/schema/companies.ts`, server routes `/api/companies`, UI `ui/src/components/Sidebar.tsx`, `OnboardingWizard.tsx` |
| Goal | Investment Thesis (UI label only) | `packages/db/src/schema/goals.ts`, `ui/src/components/NewGoalDialog.tsx` |
| Project | Thesis (UI label only) | `packages/db/src/schema/projects.ts`, `ui/src/components/NewProjectDialog.tsx` |
| Issue | (unchanged) — agent ticket | `server/src/routes/issues*.ts` |
| Agent | (unchanged) | `server/src/routes/agents.ts` |
| Clipmart | Deal Desk Library | UI template marketplace pages |

**Strategy:** Only display strings change. TypeScript interfaces, function names, API routes, DB tables stay as-is for upstream merge safety. PE-specific data goes into new `dd_*` tables.

## Onboarding wizard

- Main: `ui/src/components/OnboardingWizard.tsx` (~1273 lines, 4-step flow)
  - Step 1 (Company) ~line 659 → Fund setup
  - Step 2 (Agent) ~line 712
  - Step 3 (Task) ~line 1086 → first sourcing task
  - Step 4 (Launch) ~line 1127
- Support: `ui/src/lib/onboarding-launch.ts`, `onboarding-goal.ts`, `onboarding-route.ts`
- Context: `ui/src/context/DialogContext.tsx`

## UI labels — "Company", "Mission", "Project"

Hardcoded display strings appear in:
- `ui/src/components/OnboardingWizard.tsx` (step labels, headings ~635, 666, 700, 1149)
- `ui/src/components/NewGoalDialog.tsx`
- `ui/src/components/NewProjectDialog.tsx`
- `ui/src/components/IssueProperties.tsx`
- `ui/src/components/FileTree.tsx` (`project: "Project"`)
- `ui/src/components/IssueColumns.tsx` (`project: "Project"`)
- `ui/src/components/Sidebar.tsx` (`label="Company"`)

## Theme & branding

- CSS tokens: `ui/src/index.css` `:root` block (~lines 45–92)
  - Primary currently `oklch(0.205 0 0)` (near-black)
  - Replace primary accent with teal `#0d9488`
- Worktree branding: `server/src/ui-branding.ts` (favicon, color derivation, HTML title injection ~lines 181–189)
- CLI name: `cli/src/index.ts` line ~35 `.name("paperclipai")`
- Paperclip icon usage: `ui/src/pages/CompanySkills.tsx` (lucide-react `Paperclip` icon)

## CLI entry

- `cli/src/index.ts` defines `paperclipai` program. Onboard command in `cli/src/commands/onboard.ts`.
- To add `dealdesk` alias: add a wrapper bin entry in `cli/package.json` `bin` field and/or use Commander `.alias()`.

## Adapter registry / tool registration

- Server: `server/src/adapters/registry.ts` (~742 lines)
  - `ServerAdapterModule` interface with `type`, `execute`, `testEnvironment`, `listSkills`, `syncSkills`, `models`, `getConfigSchema`, etc.
  - `adaptersByType: Map<string, ServerAdapterModule>` mutable registry
  - `registerBuiltInAdapters()` registers claude/codex/cursor/etc.
  - External adapters via `buildExternalAdapters()` (plugin loader)
- UI: `cli/src/adapters/registry.ts` (or `ui/src/adapters/registry.ts`)

**Note:** Paperclip's tools-per-adapter pattern isn't a generic "tool registry" the way FORK.md Phase 5 anticipates. Tools are exposed to agents via the adapter's `execute()` context. PE-specific tools will need to be exposed either (a) through a new in-process MCP-style server the adapter can reach, or (b) as HTTP endpoints under `/api/deal-desk/*` that skills instruct agents to call. Strategy for Phase 5: register tools as HTTP endpoints and document them in the Deal Desk skill files.

## Skills loading

- `skills/` directory at repo root, format: `skills/<name>/SKILL.md` with YAML frontmatter:
  ```yaml
  ---
  name: <slug>
  description: >
    ...
  ---
  # Body
  ```
- `server/src/services/company-skills.ts` — skill registry service
- `server/src/services/default-agent-instructions.ts` — orchestrates skill→instructions sync
- Per-adapter `listSkills()` / `syncSkills()` (e.g. `listClaudeSkills`) scan the directory and write to the agent's `adapterConfig.instructionsBundle`

**For Phase 4:** dropping files into `skills/deal-desk/SKILL.md` etc. should auto-load — but we'll confirm by reading `company-skills.ts`.

## DB migrations (Drizzle)

- Schema source: `packages/db/src/schema/*.ts`
- Drizzle config: `packages/db/drizzle.config.ts`
  - `schema: "./dist/schema/*.js"`, `out: "./src/migrations"`, dialect postgres
- Existing migrations: `packages/db/src/migrations/0001_*.sql` ... `0018_*.sql`
- Applied at server startup via `applyPendingMigrations()` from `@paperclipai/db`
- `pnpm db:generate` → emits next numbered SQL migration

**For Phase 3:** Add a new `packages/db/src/schema/deal-desk.ts` that defines the `dd_*` tables (FORK.md specifies a single migration file, but Drizzle generates from schema files, so adding schema is the idiomatic path). Then run `pnpm db:generate` to produce the SQL.

## Route registration

- `server/src/app.ts` mounts feature routers under `/api/...` (companies, agents, goals, projects, issues, etc.)
- New Deal Desk routes: `server/src/routes/deal-desk.ts`, mount as `app.use('/api/deal-desk', dealDeskRouter)`

## Agent template / role seeding

- Demo seed: `packages/db/src/seed.ts` (small, creates a demo company + CEO agent)
- Agent defaults / pre-built configurations: `server/src/services/default-agent-instructions.ts`
- No formal "agent template" table observed — Paperclip's "hire" flow likely just creates `agents` rows with role + adapterConfig. The Deal Desk role templates can live either as:
  - A new `dd_role_templates` table, or
  - A static JSON/TS export consumed by the UI "Hire" dialog

Phase 8 will resolve this concretely after reading the hire dialog UI.

## Files likely to change per FORK.md phase

- **Phase 2 (rebrand):** root `package.json`, `cli/src/index.ts`, `cli/package.json`, `ui/src/index.css`, `ui/src/components/OnboardingWizard.tsx`, `ui/src/components/Sidebar.tsx`, `server/src/ui-branding.ts`, `README.md`, various display-string locations
- **Phase 3 (DB):** new `packages/db/src/schema/deal-desk.ts`, generated SQL in `packages/db/src/migrations/`
- **Phase 4 (skills):** new `skills/deal-desk/*.md` files only
- **Phase 5 (tools):** new `server/src/deal-desk/tools/*.ts`, possibly new HTTP endpoints in `server/src/routes/deal-desk.ts`
- **Phase 6 (fund setup):** `ui/src/components/OnboardingWizard.tsx`, new `server/src/routes/deal-desk.ts`
- **Phase 7 (dashboard pages):** new `ui/src/pages/deal-desk/*.tsx`, router config, sidebar nav
- **Phase 8 (seeds):** new `server/src/deal-desk/seeds/role-templates.ts`, possibly UI hire-dialog mods
- **Phase 9 (verify):** no new files; run typecheck/tests/manual flow

## Risks / open questions

1. **Phase 5 tool registry shape:** FORK.md assumes a generic `registry.register(tool)` API. Paperclip's actual model is per-adapter. We'll expose tools as HTTP endpoints and document them in skills — agents call them through their adapter's HTTP capability.
2. **Phase 8 agent templates:** No discovered template seeding mechanism. Will likely seed via a new lightweight table or a static export consumed by the UI hire flow.
3. **`pnpm test` runtime:** Monorepo test suite is large. Per-phase runs may take many minutes each.
