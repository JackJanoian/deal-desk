# Deal Desk — Fork Migration Prompt
# Built on Paperclip (github.com/paperclipai/paperclip)

## Status: COMPLETE
Fork of Paperclip master @ b947a7d7
Completed: 2026-05-13
Deal Desk additions:
- packages/db/src/schema/deal_desk.ts + migration 0085 (9 dd_* tables)
- skills/deal-desk/ (4 markdown files)
- server/src/deal-desk/tools/ (7 HTTP tool handlers + tests)
- server/src/deal-desk/seeds/ (5 role templates + seeder)
- server/src/routes/deal-desk.ts (PE-specific API routes)
- ui/src/pages/deal-desk/ (5 dashboard pages)
- ui/src/api/dealDesk.ts (typed client)

Modified Paperclip files (all carry // DEAL DESK: comments):
- package.json, cli/package.json, README.md (brand)
- ui/index.html (title/wordmark)
- ui/src/index.css (teal primary token)
- ui/src/App.tsx (routes), ui/src/api/index.ts (export),
  ui/src/lib/queryKeys.ts (keys)
- ui/src/components/{OnboardingWizard,Sidebar,FileTree,
  IssueColumns,IssueProperties,NewGoalDialog,NewProjectDialog}.tsx
- ui/src/context/BreadcrumbContext.tsx
- ui/src/pages/{Auth,InviteUxLab}.tsx
- packages/db/src/schema/index.ts (export of dd_* tables)
- server/src/index.ts (seed role templates after migrate)
- server/src/app.ts (mount dealDeskRoutes)

See FORK_REPORT.md for the full report.

## Project context

You are migrating **Paperclip** (a generic AI company orchestration platform)
into **Deal Desk** — a vertically specialized version for private equity
business development teams.

**The mental model shift:**
- Paperclip: "Run a company with AI agents"
- Deal Desk: "Run your PE deal sourcing team with AI agents"

**What Paperclip already has (do not rebuild):**
- Heartbeat execution engine with atomic task checkout
- Budget enforcement with hard stops at 100% spend
- Agent adapter system (Claude Code, Codex, Cursor, HTTP, bash)
- Embedded Postgres via their `packages/db/` Drizzle setup
- CLI onboarding (`npx paperclipai onboard`)
- Governance and approval workflows
- Skills runtime injection system (`skills/` directory)
- Multi-company data isolation
- The full React UI with ticket threads, org chart, budget dashboards

**What you are adding:**
- PE-specific database tables (theses, targets, intermediaries, contacts, outreach)
- PE-specific Skills files (sector sourcer, pipeline reporter, intermediary coverage)
- PE-specific agent role templates seeded into the DB
- Rebranded UI copy, labels, and onboarding flow
- PE-specific toolset (createTarget, listTargets, enrichContact, generateMemo, etc.)
- Fund setup flow replacing the generic "Company" setup

**What you are NOT doing:**
- Rebuilding anything that already works in Paperclip
- Changing the adapter system, heartbeat engine, or budget logic
- Modifying their core DB schema tables — only adding new ones
- Breaking the ability to merge upstream Paperclip updates later

---

## Hard constraints

1. **Additive only on the core.** Never modify Paperclip's existing DB tables or
   their column definitions. Only add new tables via new migration files.
2. **Never modify the adapter system.** Their `packages/adapters/` and
   `packages/adapter-utils/` work. Touch only to add Deal Desk tools.
3. **Preserve upstream merge path.** Every change must be in clearly demarcated
   files or new files. Add a `// DEAL DESK:` comment above every modification to
   existing Paperclip files so future merges are easy to resolve.
4. **TypeScript strict mode throughout.** Their codebase is strict TS. Match it.
5. **Conventional commits, commit after every phase.**
6. **Run `pnpm typecheck && pnpm test` before each commit.** Fix all type errors
   before moving on. Do not accumulate broken types across phases.
7. **Read before writing.** Before modifying any existing file, read it fully first.

---

## Phase 1 — Understand the codebase (read-only, no changes)

Before writing a single line, read these files in full:

```
server/src/
  routes/agents.ts          # How agents are created and managed
  routes/companies.ts       # The "Company" concept you're mapping to "Fund"
  adapters/registry.ts      # Mutable adapter registry — your tools plug in here
  adapters/index.ts         # Built-in adapter definitions

packages/
  db/src/                   # Drizzle schema — understand their table structure
  shared/src/
    adapter-type.ts         # How adapter types are validated
    validators/agent.ts     # Agent validation schemas

ui/src/
  adapters/registry.ts      # UI adapter registry
  pages/NewAgent.tsx        # How agent creation works in the UI
  components/AgentConfigForm.tsx  # Agent config form to understand UI patterns

skills/
  paperclip/                # Their default skills format — copy this pattern
```

After reading, write a brief `CODEBASE_NOTES.md` at the repo root summarizing:
- How Paperclip's "Company" maps to Deal Desk's "Fund"
- How Paperclip's "Project/Goal" maps to Deal Desk's "Thesis"
- Where in the codebase the onboarding wizard lives
- Where UI labels like "Company", "Mission", "Project" are defined
- Which files would need changes for each phase below

This file is for your reference only. Commit it.

### Commit
`chore(fork): codebase analysis notes`

---

## Phase 2 — Rebrand: rename, relabel, retheme

This is surface-level changes only. No logic changes.

### 2a. Package and CLI rename

**`package.json` (root):**
- Change `"name": "paperclip"` → `"name": "deal-desk"`
- Change `"version"` to `"0.1.0-fork"`
- Add `"description": "AI-powered deal sourcing for private equity teams"`
- Add to scripts: `"fork:upstream": "git fetch upstream-paperclip && git merge upstream-paperclip/master"`

**`pnpm-workspace.yaml`:** no changes needed — workspace globs are generic.

**CLI package** (find it in `cli/` or `packages/cli/`):
- Find where `npx paperclipai onboard` is defined
- Add an alias so `npx dealdesk onboard` also works
- The underlying behavior is identical — just add the alias

### 2b. Terminology remapping

Do a **targeted, surgical** find-and-replace across the UI and server.
Do NOT do a blind global replace — read each file before changing it.

The mapping:

| Paperclip term | Deal Desk term | Notes |
|---|---|---|
| Company | Fund | In UI labels, page titles, empty states |
| Mission | Investment Thesis | In UI labels only |
| Project | Thesis | In UI labels only |
| Clipmart | Deal Desk Library | Their template marketplace name |
| "zero-human company" | "AI-powered deal sourcing" | Marketing copy only |
| "Run a business" | "Source deals" | Marketing copy only |

**Files to change (UI labels only — not logic, not variable names):**

Search for these patterns in the `ui/src/` directory:
- String literals containing "Company", "Mission", "Project" in JSX/TSX display contexts
- Page `<title>` tags, `<h1>` headings, empty state messages, button labels
- Navigation labels in the sidebar

Change display strings. Do NOT rename TypeScript interfaces, function names,
or API route paths — those are internal and changing them breaks the upstream
merge path.

**Specific UI files likely to need label changes:**
- `ui/src/pages/` — page titles and headings
- `ui/src/components/` — any component with hardcoded label strings
- `ui/src/layouts/` — nav labels

Add a `{/* DEAL DESK: renamed from "Company" */}` comment above each changed
display string so future merges are easy to spot.

### 2c. Theme and branding

**`ui/src/` — find the Tailwind config or CSS variables file:**
- Keep their dark mode (it's already clean)
- Change the primary accent color to a deeper teal: `#0d9488` (Tailwind teal-600)
  instead of whatever Paperclip uses. Search for their primary color hex and replace.
- Find where the "Paperclip" logo/wordmark is rendered. Replace with "Deal Desk".
  For now, use a text wordmark — no image asset needed.
- Find the browser `<title>` tag default. Change from "Paperclip" to "Deal Desk".
- Find the favicon reference. Add a `// TODO(design): replace favicon` comment.

### 2d. Onboarding wizard copy

Find the onboarding wizard component (likely `ui/src/pages/` or
`ui/src/components/Onboarding*`). Change:

- Step title "Create your company" → "Set up your fund"
- "Company name" → "Fund name"
- "What's your company's mission?" → "Describe your investment strategy"
- "Hire your first employee" → "Hire your first AI analyst"
- Any "build a business" framing → "source deals"
- Success screen copy → "Your fund is set up. Your first AI analyst is ready."

Keep all form field names and API calls identical — only change display strings.

### 2e. README.md replacement

Replace the entire README.md with:

```markdown
# Deal Desk

> The human control plane for AI deal sourcing.

Run your private equity business development team as a team of AI agents.
Define an investment thesis, hire AI analysts, set budgets, and the system
sources acquisition targets, maps intermediary relationships, and reports
pipeline progress — autonomously.

Open source. Self-hosted. MIT licensed. Built on [Paperclip](https://github.com/paperclipai/paperclip).
Bring your own agent.

## Quick start

\`\`\`bash
npx dealdesk onboard
# or
npx paperclipai onboard
\`\`\`

Then open http://localhost:3100

## How it works

| Step | Action | Example |
|---|---|---|
| **01** | Define your thesis | "HVAC roll-up — Southeast US, $5–25M revenue, founder-owned" |
| **02** | Hire AI analysts | Sector Sourcer, Intermediary Coverage Analyst, Pipeline Reporter |
| **03** | Approve and run | Review targets. Set budgets. Monitor from the dashboard. |

## What it is

- An orchestration layer for AI-powered PE deal sourcing
- A team of AI analysts that source targets, map bankers, and draft outreach
- A governance layer where you stay in control as the board

## What it is not

- Not a CRM — it syncs to yours (Affinity, DealCloud, HubSpot)
- Not an agent runtime — bring your own (Claude Code, Codex, Cursor, HTTP)
- Not a data provider — connect your own (Apollo, Hunter, web search)
- Not a chat interface — agents work through structured tickets

## Built on Paperclip

Deal Desk is a fork of [Paperclip](https://github.com/paperclipai/paperclip),
the open-source AI company orchestration platform. We use their heartbeat
engine, adapter system, budget enforcement, and governance layer — and add
PE-specific primitives on top.

## Works with

Claude Code · OpenClaw · Codex · Cursor · Any HTTP endpoint

## License

MIT © 2026 Deal Desk Contributors
(Forked from Paperclip, MIT © 2026 Paperclip)
```

### Commit
`feat(brand): rename to deal desk, retheme UI, update onboarding copy`

---

## Phase 3 — PE database tables

Add Deal Desk's PE-specific tables as a **new Drizzle migration file**.
Do not modify Paperclip's existing schema files.

### Find the migration directory

Read `packages/db/src/` to understand where Paperclip stores migrations and how
`drizzle-kit` is configured. Find the `drizzle.config.ts` or equivalent.

### Create `packages/db/src/migrations/deal-desk-001-pe-tables.ts`

This file adds all PE-specific tables using Drizzle's pg-core. All tables are
prefixed with `dd_` to namespace them cleanly away from Paperclip's tables and
make future merges unambiguous.

```typescript
// packages/db/src/migrations/deal-desk-001-pe-tables.ts
// DEAL DESK: All PE-specific tables. Additive only — no Paperclip tables modified.

import {
  pgTable, pgEnum, uuid, text, varchar,
  numeric, integer, boolean, timestamp, date, jsonb,
  index, uniqueIndex, foreignKey
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ddThesisStatusEnum = pgEnum('dd_thesis_status', [
  'active', 'paused', 'archived'
])

export const ddTargetStatusEnum = pgEnum('dd_target_status', [
  'sourced', 'qualified', 'contacted', 'replied',
  'meeting_booked', 'in_diligence', 'passed', 'closed_won', 'closed_lost'
])

export const ddEmailStatusEnum = pgEnum('dd_email_status', [
  'unverified', 'verified', 'bounced', 'invalid'
])

export const ddSuppressionReasonEnum = pgEnum('dd_suppression_reason', [
  'unsubscribed', 'bounced', 'manual', 'replied_not_interested'
])

export const ddOutreachSendStatusEnum = pgEnum('dd_outreach_send_status', [
  'queued', 'awaiting_approval', 'sent', 'replied', 'bounced', 'unsubscribed', 'failed'
])

// ── dd_theses ──────────────────────────────────────────────────────────────────
// An investment mandate. Maps to Paperclip's "Project/Goal" concept but with
// PE-specific financial criteria. Links to Paperclip's company via companyId.

export const ddTheses = pgTable('dd_theses', {
  id:                   uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // Links to Paperclip's existing companies table — no FK constraint to stay
  // merge-safe, but the value is always a valid Paperclip company ID.
  paperclipCompanyId:   varchar('paperclip_company_id', { length: 255 }).notNull(),
  name:                 varchar('name', { length: 255 }).notNull(),
  sector:               varchar('sector', { length: 255 }).notNull(),
  subSectors:           jsonb('sub_sectors').notNull().default([]),
  geos:                 jsonb('geos').notNull().default([]),
  revenueMin:           numeric('revenue_min', { precision: 15, scale: 2 }),
  revenueMax:           numeric('revenue_max', { precision: 15, scale: 2 }),
  ebitdaMin:            numeric('ebitda_min', { precision: 15, scale: 2 }),
  ebitdaMax:            numeric('ebitda_max', { precision: 15, scale: 2 }),
  dealSizeMin:          numeric('deal_size_min', { precision: 15, scale: 2 }),
  dealSizeMax:          numeric('deal_size_max', { precision: 15, scale: 2 }),
  ownershipPreferences: jsonb('ownership_preferences').notNull().default([]),
  exclusionCriteria:    text('exclusion_criteria'),
  narrative:            text('narrative'),
  status:               ddThesisStatusEnum('status').notNull().default('active'),
  templateSlug:         varchar('template_slug', { length: 255 }),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('dd_theses_company_id_idx').on(t.paperclipCompanyId),
  index('dd_theses_status_idx').on(t.status),
])

// ── dd_targets ─────────────────────────────────────────────────────────────────
// A company sourced by an agent. First-class PE primitive.

export const ddTargets = pgTable('dd_targets', {
  id:                  uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  paperclipCompanyId:  varchar('paperclip_company_id', { length: 255 }).notNull(),
  thesisId:            uuid('thesis_id').notNull().references(() => ddTheses.id, { onDelete: 'cascade' }),
  // Paperclip agent ID that sourced this target (from their agents table)
  sourcedByAgentId:    varchar('sourced_by_agent_id', { length: 255 }),
  // Paperclip issue/ticket ID where this target was reported
  sourceTicketId:      varchar('source_ticket_id', { length: 255 }),
  companyName:         varchar('company_name', { length: 255 }).notNull(),
  website:             varchar('website', { length: 2048 }),
  description:         text('description'),
  sector:              varchar('sector', { length: 255 }),
  subSector:           varchar('sub_sector', { length: 255 }),
  hqCity:              varchar('hq_city', { length: 255 }),
  hqState:             varchar('hq_state', { length: 100 }),
  hqCountry:           varchar('hq_country', { length: 100 }).notNull().default('US'),
  estimatedRevenue:    numeric('estimated_revenue', { precision: 15, scale: 2 }),
  estimatedEbitda:     numeric('estimated_ebitda', { precision: 15, scale: 2 }),
  estimatedEmployees:  integer('estimated_employees'),
  ownershipType:       varchar('ownership_type', { length: 100 }),
  fitScore:            integer('fit_score'),         // 0–100
  fitRationale:        text('fit_rationale'),
  sources:             jsonb('sources').notNull().default([]),
  status:              ddTargetStatusEnum('status').notNull().default('sourced'),
  tags:                jsonb('tags').notNull().default([]),
  notes:               text('notes'),
  crmExternalId:       varchar('crm_external_id', { length: 255 }),
  statusChangedAt:     timestamp('status_changed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('dd_targets_company_id_idx').on(t.paperclipCompanyId),
  index('dd_targets_thesis_id_idx').on(t.thesisId),
  index('dd_targets_status_idx').on(t.status),
  index('dd_targets_fit_score_idx').on(t.fitScore),
  uniqueIndex('dd_targets_company_name_idx').on(t.paperclipCompanyId, t.companyName),
])

// ── dd_intermediaries ──────────────────────────────────────────────────────────
// Bankers, brokers, other deal-flow sources. Relationship-based workflow.

export const ddIntermediaries = pgTable('dd_intermediaries', {
  id:                   uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  paperclipCompanyId:   varchar('paperclip_company_id', { length: 255 }).notNull(),
  name:                 varchar('name', { length: 255 }).notNull(),
  firm:                 varchar('firm', { length: 255 }),
  title:                varchar('title', { length: 255 }),
  coverageSectors:      jsonb('coverage_sectors').notNull().default([]),
  coverageSizeMin:      numeric('coverage_size_min', { precision: 15, scale: 2 }),
  coverageSizeMax:      numeric('coverage_size_max', { precision: 15, scale: 2 }),
  email:                varchar('email', { length: 255 }),
  linkedinUrl:          varchar('linkedin_url', { length: 2048 }),
  phone:                varchar('phone', { length: 50 }),
  recentDeals:          jsonb('recent_deals').notNull().default([]),
  lastTouchDate:        date('last_touch_date'),
  cadenceDays:          integer('cadence_days').notNull().default(60),
  nextTouchDue:         date('next_touch_due'),
  relationshipStrength: integer('relationship_strength').notNull().default(1),
  notes:                text('notes'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('dd_intermediaries_company_id_idx').on(t.paperclipCompanyId),
  index('dd_intermediaries_next_touch_due_idx').on(t.nextTouchDue),
])

// ── dd_contacts ────────────────────────────────────────────────────────────────
// A person at a target company. Surfaced by Contact Enricher agent.

export const ddContacts = pgTable('dd_contacts', {
  id:                uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  targetId:          uuid('target_id').notNull().references(() => ddTargets.id, { onDelete: 'cascade' }),
  paperclipCompanyId: varchar('paperclip_company_id', { length: 255 }).notNull(),
  firstName:         varchar('first_name', { length: 255 }).notNull(),
  lastName:          varchar('last_name', { length: 255 }),
  title:             varchar('title', { length: 255 }),
  email:             varchar('email', { length: 255 }),
  emailStatus:       ddEmailStatusEnum('email_status').notNull().default('unverified'),
  linkedinUrl:       varchar('linkedin_url', { length: 2048 }),
  phone:             varchar('phone', { length: 50 }),
  enrichedByAgentId: varchar('enriched_by_agent_id', { length: 255 }),
  enrichedAt:        timestamp('enriched_at', { withTimezone: true }),
  source:            varchar('source', { length: 100 }),
  isPrimary:         boolean('is_primary').notNull().default(false),
  notes:             text('notes'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('dd_contacts_target_id_idx').on(t.targetId),
  index('dd_contacts_company_id_idx').on(t.paperclipCompanyId),
])

// ── dd_outreach_campaigns ──────────────────────────────────────────────────────
// Cold email sequences. v0.1 schema only — no sending logic yet.

export const ddOutreachCampaigns = pgTable('dd_outreach_campaigns', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  paperclipCompanyId: varchar('paperclip_company_id', { length: 255 }).notNull(),
  thesisId:       uuid('thesis_id').references(() => ddTheses.id, { onDelete: 'set null' }),
  name:           varchar('name', { length: 255 }).notNull(),
  cadenceSteps:   jsonb('cadence_steps').notNull().default([]),
  dailySendCap:   integer('daily_send_cap').notNull().default(30),
  approvalMode:   boolean('approval_mode').notNull().default(true),
  fromMailboxRef: varchar('from_mailbox_ref', { length: 255 }),
  status:         varchar('status', { length: 50 }).notNull().default('draft'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('dd_outreach_campaigns_company_id_idx').on(t.paperclipCompanyId),
])

// ── dd_outreach_sends ──────────────────────────────────────────────────────────

export const ddOutreachSends = pgTable('dd_outreach_sends', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  paperclipCompanyId: varchar('paperclip_company_id', { length: 255 }).notNull(),
  campaignId:       uuid('campaign_id').notNull().references(() => ddOutreachCampaigns.id, { onDelete: 'cascade' }),
  targetId:         uuid('target_id').notNull().references(() => ddTargets.id, { onDelete: 'cascade' }),
  contactId:        uuid('contact_id').references(() => ddContacts.id, { onDelete: 'set null' }),
  cadenceStep:      integer('cadence_step').notNull().default(0),
  subject:          varchar('subject', { length: 500 }).notNull(),
  body:             text('body').notNull(),
  status:           ddOutreachSendStatusEnum('status').notNull().default('queued'),
  draftedByAgentId: varchar('drafted_by_agent_id', { length: 255 }),
  approvedByUserId: varchar('approved_by_user_id', { length: 255 }),
  approvedAt:       timestamp('approved_at', { withTimezone: true }),
  scheduledSendAt:  timestamp('scheduled_send_at', { withTimezone: true }),
  sentAt:           timestamp('sent_at', { withTimezone: true }),
  repliedAt:        timestamp('replied_at', { withTimezone: true }),
  externalMessageId: varchar('external_message_id', { length: 500 }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('dd_outreach_sends_company_id_idx').on(t.paperclipCompanyId),
  index('dd_outreach_sends_campaign_id_idx').on(t.campaignId),
  index('dd_outreach_sends_status_idx').on(t.status),
  uniqueIndex('dd_outreach_sends_campaign_contact_step_idx').on(t.campaignId, t.contactId, t.cadenceStep),
])

// ── dd_suppression_list ────────────────────────────────────────────────────────

export const ddSuppressionList = pgTable('dd_suppression_list', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  paperclipCompanyId: varchar('paperclip_company_id', { length: 255 }).notNull(),
  emailOrDomain: varchar('email_or_domain', { length: 255 }).notNull(),
  reason:        ddSuppressionReasonEnum('reason').notNull(),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('dd_suppression_list_company_email_idx').on(t.paperclipCompanyId, t.emailOrDomain),
])

// ── dd_memos ───────────────────────────────────────────────────────────────────
// Weekly pipeline memos generated by the Pipeline Reporter agent.

export const ddMemos = pgTable('dd_memos', {
  id:                 uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  paperclipCompanyId: varchar('paperclip_company_id', { length: 255 }).notNull(),
  generatedByAgentId: varchar('generated_by_agent_id', { length: 255 }),
  weekStartDate:      date('week_start_date').notNull(),
  markdown:           text('markdown').notNull(),
  metricsSnapshot:    jsonb('metrics_snapshot').notNull().default({}),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('dd_memos_company_id_idx').on(t.paperclipCompanyId),
  uniqueIndex('dd_memos_company_week_idx').on(t.paperclipCompanyId, t.weekStartDate),
])
```

### Wire the migration into Paperclip's migration runner

Find how Paperclip runs its migrations (likely `packages/db/src/migrate.ts` or
a drizzle config). Add the Deal Desk migration file to the migration list so it
runs automatically on startup.

### Generate the raw SQL

Run `pnpm db:generate` to generate the SQL migration file from the schema.
Verify the output contains all `dd_` prefixed tables and no modifications to
existing Paperclip tables.

### Tests

Write a migration test in `packages/db/src/__tests__/deal-desk-tables.test.ts`:
- Verify all `dd_` tables are created
- Verify basic CRUD on `dd_theses` and `dd_targets`
- Verify the unique index on `dd_targets` (fund + company name) prevents duplicates
- Verify no existing Paperclip table is modified

### Commit
`feat(db): add deal desk PE tables via additive migration`

---

## Phase 4 — PE Skills files

Skills files are markdown documents injected at runtime into every agent heartbeat.
This is Paperclip's context injection mechanism — and it's the fastest way to make
their existing agent system PE-aware without touching any code.

Read the existing `skills/paperclip/` directory to understand the exact format.
Then create the following new directory and files:

### `skills/deal-desk/` — new directory

**`skills/deal-desk/SKILL.md`** — the master deal desk skill, loaded for every agent:

```markdown
# Deal Desk — Core Skills

You are an AI analyst working in Deal Desk, a private equity deal sourcing platform.
You work within a structured ticket system. Every task you receive has been assigned
by the fund's BD team. Your job is to execute the task, report results clearly, and
escalate anything that requires human judgment.

## How Deal Desk works

- **Fund**: The private equity firm you work for. Your "company" in Paperclip terms.
- **Thesis**: An investment mandate with defined criteria (sector, geography, revenue range).
  This is what you source against. Always confirm the active thesis before starting work.
- **Target**: A company that matches the thesis. When you find one, record it using
  the createTarget tool. Every target needs a fit score and fit rationale.
- **Ticket**: Your work order. Read the ticket carefully. Post progress updates using
  postTicketMessage. Close the ticket with a summary when your work is done.
- **Budget**: You have a monthly token budget. When you see "budget remaining: $X",
  stop cleanly before it hits $0. Post your progress first, then stop.

## Output standards

- **Terse and sourced.** Write like a sharp associate to a busy MD.
- **Cite everything.** If you state a revenue figure, cite where you found it.
- **Honest uncertainty.** If you can't verify something, say "unknown" and explain what
  would confirm it. Never fabricate data.
- **Score honestly.** Fit scores of 80+ should be rare. Most targets are 50–70.
  Reserve 80+ for companies that clearly meet all hard criteria.

## Tools available to you

Depending on your role, you may have access to:
- `webSearch` — search the public web
- `webFetch` — fetch a specific URL and read its content
- `createTarget` — save a sourced company to the Deal Desk database
- `listTargets` — see targets already in the database (avoid duplicates)
- `createIntermediary` — save a banker or broker contact
- `listIntermediaries` — see intermediaries already tracked
- `recordIntermediaryTouch` — log a contact with an intermediary
- `enrichContact` — find a contact person at a target company
- `generateMemo` — generate the weekly pipeline memo

## What you must never do

- Never fabricate company data, revenue figures, or contact information
- Never draft or send emails (unless you are the Outreach Operator role)
- Never make investment recommendations — source and score only
- Never share information about one target with another target's contacts
```

**`skills/deal-desk/sector-sourcer.md`** — loaded for Sector Sourcer agents:

```markdown
# Sector Sourcer — Role Skills

Your sole job is to find acquisition targets that match the active investment thesis.

## Heartbeat workflow

1. **Check existing targets first.** Call `listTargets` for the active thesis.
   Never re-add a company already in the database.

2. **Search systematically.** Good search strategies:
   - `"[sector] company [city/state]"` — direct geo-sector queries
   - Industry association membership directories (ACCA, MSCA, PHCC, NACS, etc.)
   - Trade publication deal announcements and "fastest growing" lists
   - Google Maps for service businesses: `"[sector] near [city]"`
   - State business registry searches for recently licensed businesses

3. **Fetch the website.** For every promising candidate, call `webFetch` on their
   website. Look for: service description, locations served, team size signals,
   years in business, ownership signals (family business, founder-led language).

4. **Score honestly.** Criteria for fit scores:
   - **80–100**: Meets all hard criteria with confidence. Revenue and geography confirmed.
   - **60–79**: Likely fit. Most criteria met, some assumptions required.
   - **40–59**: Possible fit. Meets geography or sector but revenue or ownership unclear.
   - **Below 40**: Do not add to the database.

5. **Write the rationale.** 2–3 sentences. Reference specific thesis criteria.
   Example: "Commercial HVAC contractor serving metro Atlanta and surrounding suburbs.
   Website references 25+ years in business and a 40-person team, suggesting $8–12M
   revenue range. Founder-operated based on 'about us' page language. Fits geo,
   sector, and ownership criteria. Revenue estimate unconfirmed — suggest outreach
   to validate."

6. **Call createTarget.** Include all sources as URLs in the `sources` array.

7. **Post a heartbeat summary.** At the end, call `postTicketMessage` with:
   - Searches run (queries used)
   - Candidates reviewed
   - Targets added (with top 3 by fit score)
   - Thesis gaps or ambiguities noticed

## Quality over quantity

5 well-researched targets per heartbeat beats 30 superficial ones. The human
reviews your work. Make it worth reviewing.
```

**`skills/deal-desk/pipeline-reporter.md`** — loaded for Pipeline Reporter agents:

```markdown
# Pipeline Reporter — Role Skills

You generate the weekly BD memo every Monday at 7am. This is the most-read artifact
Deal Desk produces. Make it scannable in 90 seconds.

## Memo structure (required, in this order)

### 1. Headline metrics
Targets sourced (7d) | Outreach sent (7d) | Replies | Meetings booked

### 2. Top 5 new targets this week
| Company | Sector | Fit Score | One-line rationale |

### 3. Replies needing attention
List any prospect replies awaiting human response. If none: "No replies this week."

### 4. Outreach performance
Sent / Replied / Bounced this week vs. prior week.

### 5. Intermediary coverage
Touches completed this week. Overdue touches (past cadence date). New intermediaries added.

### 6. Budget status
Each active agent: name, spend MTD, % of monthly cap used.

### 7. Recommended actions
3–5 bullets. Specific and actionable. Example:
- "3 qualified targets in the Atlanta market have no primary contact — run Contact
  Enricher before next outreach cycle"
- "Intermediary coverage for Southeast HVAC sector has 4 overdue touches — prioritize
  this week"

## Tone

Direct. No marketing language. No superlatives. Write like an associate
to a busy MD who has 90 seconds to read this before a Monday morning call.

## After generating

Save the memo using `generateMemo`. The human will see it in the dashboard.
```

**`skills/deal-desk/intermediary-coverage.md`** — loaded for Intermediary Coverage agents:

```markdown
# Intermediary Coverage — Role Skills

Your job is to ensure the fund stays top-of-mind with every banker and broker
who might source relevant deals. Never let a relationship go cold.

## Key rules

- **Cadence first.** Always start by checking which intermediaries are overdue
  (past their nextTouchDue date). These get priority over finding new ones.
- **Personalize every touch.** Reference a specific recent deal they closed.
  Do not send generic "just checking in" emails.
- **Keep it short.** Check-in emails must be under 150 words.
- **Draft, don't send.** Post the draft email in the ticket body with the
  recipient's email clearly noted. The human sends it — you draft it.
- **Find new coverage.** After handling overdue touches, source 3–5 new
  intermediaries active in the thesis sector. Use webSearch to find recent
  M&A deal announcements and identify the advisors involved.

## Draft email format

**To:** [email]
**Subject:** [specific subject referencing a deal or sector development]

[Body — max 150 words. Reference their recent deal. Ask about deal flow.
Warm but professional. No fluff.]
```

### Register the skills

Find how Paperclip loads skills from the `skills/` directory (likely in
`server/src/` somewhere, or configured in the CLI). Ensure the `deal-desk/`
directory is included in the skills loading path. If skills auto-load by directory,
no change needed — just verify the new files appear in the skills manager UI.

### Commit
`feat(skills): deal desk PE skills — sector sourcer, pipeline reporter, intermediary coverage`

---

## Phase 5 — PE toolset

Add the Deal Desk tools that agents call during heartbeats. These plug into
Paperclip's existing tool/adapter system.

### Find the tool registration point

Read `server/src/adapters/registry.ts` and `server/src/adapters/index.ts` to
understand how Paperclip registers tools that agents can call. Find where their
built-in tools (web search, file operations, etc.) are registered.

### Create `server/src/deal-desk/tools/`

Create this directory with one file per tool. Each tool must conform to whatever
interface Paperclip's tool registry expects (read the existing tools to find the
exact interface before writing).

**`server/src/deal-desk/tools/create-target.ts`**

```typescript
// DEAL DESK: Tool for agents to persist sourced acquisition targets
import { z } from 'zod'
import { db } from '../../../db' // use Paperclip's existing DB connection
import { ddTargets } from '../../../../packages/db/src/migrations/deal-desk-001-pe-tables'

const CreateTargetInput = z.object({
  thesisId:          z.string().uuid(),
  companyName:       z.string().min(1).max(255),
  website:           z.string().url().optional(),
  description:       z.string().optional(),
  sector:            z.string().optional(),
  subSector:         z.string().optional(),
  hqCity:            z.string().optional(),
  hqState:           z.string().optional(),
  estimatedRevenue:  z.number().positive().optional(),
  ownershipType:     z.string().optional(),
  fitScore:          z.number().int().min(0).max(100),
  fitRationale:      z.string().min(10),
  sources:           z.array(z.object({ url: z.string(), description: z.string() })),
})

export const createTargetTool = {
  name: 'createTarget',
  description: 'Save a sourced acquisition target to the Deal Desk database. ' +
    'Call this after researching a company that matches the active thesis. ' +
    'Always include source URLs and a fit rationale.',
  inputSchema: CreateTargetInput,
  execute: async (input: z.infer<typeof CreateTargetInput>, ctx: ToolContext) => {
    // Validate fitScore threshold — don't persist low-quality targets
    if (input.fitScore < 40) {
      return { ok: false, reason: 'Fit score below 40 — target not saved. ' +
        'Only call createTarget for companies scoring 40 or above.' }
    }

    try {
      // Check for duplicate by company name within the fund
      const existing = await db.query.ddTargets.findFirst({
        where: (t, { eq, and }) => and(
          eq(t.paperclipCompanyId, ctx.companyId),
          eq(t.companyName, input.companyName)
        )
      })

      if (existing) {
        // Append to notes rather than duplicating
        await db.update(ddTargets)
          .set({
            notes: `${existing.notes ?? ''}\n\n[Re-sourced ${new Date().toISOString()}]\n${input.fitRationale}`,
            updatedAt: new Date(),
          })
          .where(eq(ddTargets.id, existing.id))

        return { ok: true, targetId: existing.id, action: 'updated_existing',
          message: `Target already exists — appended new rationale to notes.` }
      }

      const [target] = await db.insert(ddTargets).values({
        paperclipCompanyId: ctx.companyId,
        thesisId:           input.thesisId,
        sourcedByAgentId:   ctx.agentId,
        sourceTicketId:     ctx.issueId,
        companyName:        input.companyName,
        website:            input.website,
        description:        input.description,
        sector:             input.sector,
        subSector:          input.subSector,
        hqCity:             input.hqCity,
        hqState:            input.hqState,
        estimatedRevenue:   input.estimatedRevenue?.toString(),
        ownershipType:      input.ownershipType,
        fitScore:           input.fitScore,
        fitRationale:       input.fitRationale,
        sources:            input.sources,
        status:             'sourced',
      }).returning()

      return { ok: true, targetId: target.id, action: 'created',
        message: `Target "${input.companyName}" saved with fit score ${input.fitScore}.` }

    } catch (error) {
      return { ok: false, reason: `Database error: ${error instanceof Error ? error.message : 'unknown'}` }
    }
  }
}
```

**`server/src/deal-desk/tools/list-targets.ts`**

```typescript
// DEAL DESK: Tool for agents to see existing targets (avoid re-sourcing)
export const listTargetsTool = {
  name: 'listTargets',
  description: 'List existing targets in the database for a thesis. ' +
    'Always call this at the start of a sourcing heartbeat to avoid duplicates.',
  inputSchema: z.object({
    thesisId: z.string().uuid(),
    status:   z.string().optional(),
    limit:    z.number().int().min(1).max(100).default(50),
  }),
  execute: async (input, ctx) => {
    const targets = await db.query.ddTargets.findMany({
      where: (t, { eq, and }) => and(
        eq(t.paperclipCompanyId, ctx.companyId),
        eq(t.thesisId, input.thesisId),
        input.status ? eq(t.status, input.status as any) : undefined
      ),
      limit: input.limit,
      orderBy: (t, { desc }) => [desc(t.fitScore)],
      columns: { id: true, companyName: true, website: true, fitScore: true,
                 status: true, hqState: true, createdAt: true }
    })

    return {
      count: targets.length,
      targets: targets.map(t => ({
        id: t.id,
        name: t.companyName,
        website: t.website,
        fitScore: t.fitScore,
        status: t.status,
        state: t.hqState,
        sourcedAt: t.createdAt,
      }))
    }
  }
}
```

**`server/src/deal-desk/tools/create-intermediary.ts`**
- Similar pattern to createTarget
- Inputs: name, firm, title, email, linkedinUrl, coverageSectors, recentDeals[], notes
- Deduplicates by (companyId + name + firm)
- Sets nextTouchDue = today + cadenceDays on creation

**`server/src/deal-desk/tools/list-intermediaries.ts`**
- Inputs: overdueOnly (boolean), sector (string), limit
- Returns intermediaries sorted by nextTouchDue ASC (overdue first)
- Marks overdue: nextTouchDue < today

**`server/src/deal-desk/tools/record-intermediary-touch.ts`**
- Inputs: intermediaryId, touchType, notes
- Updates lastTouchDate = today
- Recalculates nextTouchDue = today + cadenceDays
- Returns the updated intermediary record

**`server/src/deal-desk/tools/generate-memo.ts`**
- Inputs: markdown (string), weekStartDate (string)
- Inserts into dd_memos
- Returns memoId
- Idempotent: if a memo for that week already exists, updates it rather than duplicating

**`server/src/deal-desk/tools/enrich-contact.ts`**
- Inputs: targetId, titlesToSearch (string[])
- Queries Apollo if APOLLO_API_KEY is set, else falls back to Hunter, else web search
- Persists results to dd_contacts
- Returns found contacts with confidence scores
- If no API keys configured: returns a helpful message explaining how to set them

### Register all tools

Find Paperclip's tool registry and register all 7 Deal Desk tools. Add a
`// DEAL DESK:` comment above the registration block.

Create `server/src/deal-desk/tools/index.ts` that exports all tools and a
`registerDealDeskTools(registry)` function. Call this from the main server
startup file (find where Paperclip initializes the tool registry).

### Tests

`server/src/__tests__/deal-desk-tools.test.ts`:
- createTarget: verify save, verify duplicate handling (updates notes), verify fitScore < 40 blocked
- listTargets: verify it returns only targets for the given company and thesis
- recordIntermediaryTouch: verify nextTouchDue is correctly recalculated

### Commit
`feat(tools): deal desk PE toolset — createTarget, listTargets, intermediary tools, memo generator`

---

## Phase 6 — Fund setup flow

The Paperclip onboarding creates a "Company" with a "Mission." Extend it to
capture PE-specific fund metadata and auto-create the first thesis.

### Find the onboarding flow

Read the onboarding wizard component (likely `ui/src/pages/Onboarding*` or
`ui/src/components/Onboarding*`). Understand how company creation works.

### Add a "Fund setup" step

After the existing "Create your company" step, add a new step:
**"Set up your first investment thesis"**

This step renders a form with:
- Sector (text input with autocomplete: HVAC, Healthcare Services, B2B SaaS, etc.)
- Geography (multi-select US states or "nationwide")
- Revenue range (min / max — numeric inputs with $ formatting)
- Ownership preference (checkboxes: Founder-owned, Family-owned, Sponsor-backed)
- Free-text narrative (textarea: "Describe your investment thesis in your own words")

On submit, call a new server endpoint:
`POST /companies/:companyId/deal-desk/theses`

This creates a `dd_theses` row with the form data.

### Add thesis templates

Below the form, add a "Start from a template" option. Clicking it shows three cards:

**HVAC Roll-up — Southeast US**
Sector: HVAC Services · Geo: FL, GA, NC, SC, TN, AL · Revenue: $5–25M

**Healthcare Services — Lower Middle Market**
Sector: Healthcare Services · Geo: United States · Revenue: $5–50M

**Search Fund — Generalist LMM**
Sector: Diversified · Geo: United States · Revenue: $3–20M

Clicking a card pre-fills the form. User can still edit before submitting.

### New server route

`server/src/routes/deal-desk.ts` — DEAL DESK: New route file, not modifying
existing routes.

```typescript
// DEAL DESK: PE-specific API routes
import { Router } from 'express' // or whatever Paperclip uses for routing
import { db } from '../db'
import { ddTheses, ddTargets, ddIntermediaries, ddMemos } from '../../packages/db/src/migrations/deal-desk-001-pe-tables'

const router = Router()

// Create a thesis for a fund
router.post('/companies/:companyId/deal-desk/theses', async (req, res) => { ... })

// Get all theses for a fund
router.get('/companies/:companyId/deal-desk/theses', async (req, res) => { ... })

// Get all targets for a thesis
router.get('/companies/:companyId/deal-desk/theses/:thesisId/targets', async (req, res) => { ... })

// Update target status
router.patch('/companies/:companyId/deal-desk/targets/:targetId/status', async (req, res) => { ... })

// Get intermediaries for a fund
router.get('/companies/:companyId/deal-desk/intermediaries', async (req, res) => { ... })

// Get memos for a fund
router.get('/companies/:companyId/deal-desk/memos', async (req, res) => { ... })

export { router as dealDeskRouter }
```

Register this router in Paperclip's main Express app (find where routes are
registered — likely `server/src/index.ts` or `server/src/app.ts`). Add:
```typescript
// DEAL DESK:
import { dealDeskRouter } from './routes/deal-desk'
app.use('/api', dealDeskRouter)
```

### Commit
`feat(ui+server): fund thesis setup flow with PE templates`

---

## Phase 7 — PE dashboard pages

Add new UI routes for the Deal Desk views. These are **new pages** — not
modifications to existing Paperclip pages.

### Find the router

Read `ui/src/` to find how Paperclip handles routing (likely React Router).
Find where routes are registered and add the new ones.

### New pages to create

**`ui/src/pages/deal-desk/Targets.tsx`**
- Route: `/companies/:companyId/deal-desk/targets`
- Filterable table: company name, sector, state, fit score badge (color-coded),
  status badge, sourced date
- Fit score color coding: green (80+), yellow (60–79), orange (40–59)
- Click row → drawer with target detail (company facts, fit rationale, sources list,
  status selector, notes)
- "Source targets now" button → creates a ticket assigned to the Sector Sourcer agent

**`ui/src/pages/deal-desk/Intermediaries.tsx`**
- Route: `/companies/:companyId/deal-desk/intermediaries`
- Table sorted by nextTouchDue ASC
- Overdue rows highlighted with a red left border
- Columns: name, firm, sector coverage, last touch, next due, relationship strength (stars)
- "Add intermediary" button → inline form

**`ui/src/pages/deal-desk/Memos.tsx`**
- Route: `/companies/:companyId/deal-desk/memos`
- List of generated memos with week date
- Click → renders the markdown as formatted text (use a markdown renderer if
  Paperclip already has one; otherwise add `react-markdown`)

**`ui/src/pages/deal-desk/Thesis.tsx`**
- Route: `/companies/:companyId/deal-desk/theses/:thesisId`
- Shows thesis criteria in a card
- Tabs: Targets / Activity
- Edit button → opens the thesis form pre-filled

### Add nav links

Find the Paperclip sidebar navigation component. Add a "Deal Sourcing" section
with links to Targets, Intermediaries, and Memos. Add a `{/* DEAL DESK: */}`
comment above the new nav items.

### Follow Paperclip's UI patterns

Before building any component, read 2–3 existing Paperclip pages to understand:
- How they fetch data (probably React Query or SWR)
- How they handle loading states
- Which shadcn/ui components they use
- How they structure page layouts

Match their patterns exactly — don't introduce a new data fetching library or
component library. Consistency is more important than preference here.

### Commit
`feat(ui): targets, intermediaries, and memos dashboard pages`

---

## Phase 8 — PE agent role templates (seeded data)

Pre-build the five Deal Desk agent roles so users can hire them in one click
from the Paperclip org chart.

### Find the seed mechanism

Read `packages/db/src/` to find how Paperclip seeds data (templates, example
companies, etc.). Find the seed script.

### Create `server/src/deal-desk/seeds/role-templates.ts`

Define the five Deal Desk roles as Paperclip "Agent Templates" (or however
Paperclip calls pre-built agent configurations — read their code to find the
right term and data shape).

Each role template includes:
- Display name
- Description (shown in the "Hire" UI)
- Default system prompt (the full text from our Skills files above, condensed)
- Recommended adapter (anthropic_api for all)
- Recommended heartbeat schedule
- Recommended monthly budget
- Skill files to auto-load (the deal-desk/ skills)

**The five roles:**

```typescript
export const dealDeskRoleTemplates = [
  {
    slug: 'dd-sector-sourcer',
    name: 'Sector Sourcer',
    description: 'Sources acquisition targets matching your investment thesis. ' +
      'Runs on a schedule, searches the web, scores companies, and builds your target list.',
    defaultHeartbeatCron: '0 */4 * * *',  // every 4 hours
    defaultBudgetUsd: 50,
    skillFiles: ['deal-desk/SKILL.md', 'deal-desk/sector-sourcer.md'],
    systemPrompt: `You are a senior PE business development analyst...` // full prompt
  },
  {
    slug: 'dd-pipeline-reporter',
    name: 'Pipeline Reporter',
    description: 'Generates your Monday morning BD memo. Summarizes new targets, ' +
      'outreach activity, intermediary coverage, and budget status.',
    defaultHeartbeatCron: '0 7 * * 1',   // Monday 7am
    defaultBudgetUsd: 20,
    skillFiles: ['deal-desk/SKILL.md', 'deal-desk/pipeline-reporter.md'],
    systemPrompt: `You are the Pipeline Reporter for this fund...`
  },
  {
    slug: 'dd-intermediary-coverage',
    name: 'Intermediary Coverage Analyst',
    description: 'Maps bankers and brokers in your thesis sectors and manages ' +
      'systematic check-in touches so no relationship goes cold.',
    defaultHeartbeatCron: '0 8 * * 1',   // Monday 8am
    defaultBudgetUsd: 25,
    skillFiles: ['deal-desk/SKILL.md', 'deal-desk/intermediary-coverage.md'],
    systemPrompt: `You are a BD analyst responsible for intermediary coverage...`
  },
  {
    slug: 'dd-contact-enricher',
    name: 'Contact Enricher',
    description: 'Finds the right person to contact at each target company — ' +
      'owner, CEO, or primary decision-maker — and surfaces their email and LinkedIn.',
    defaultHeartbeatCron: '0 */6 * * *',  // every 6 hours
    defaultBudgetUsd: 30,
    skillFiles: ['deal-desk/SKILL.md'],
    systemPrompt: `You are a research analyst finding contact information...`
  },
  {
    slug: 'dd-head-of-bd',
    name: 'Head of BD',
    description: 'Orchestrates the full deal sourcing team. Decomposes the thesis ' +
      'into mandates, delegates to sector analysts, and summarizes pipeline for the partners.',
    defaultHeartbeatCron: '0 9 * * 1',   // Monday 9am
    defaultBudgetUsd: 40,
    skillFiles: ['deal-desk/SKILL.md'],
    systemPrompt: `You are the Head of Business Development for this fund...`
  },
]
```

### Wire into seed or startup

Find the right place in Paperclip's startup sequence to seed these templates.
They should appear in the "Hire an agent" dialog under a "Deal Desk" section.

If Paperclip has an existing "agent template" or "role" seeding mechanism, use it.
If not, seed directly into whatever table stores pre-built agent configurations.

### Commit
`feat(seeds): deal desk PE role templates for sector sourcer, reporter, intermediary, enricher, head of bd`

---

## Phase 9 — Final wiring and verification

### 9a. Verify the full flow end-to-end

Manually verify (or write an E2E test for) this exact sequence:

1. Run `pnpm dev` — app starts clean
2. Run onboarding wizard — creates a Fund with a thesis
3. Navigate to Org Chart — see the 5 Deal Desk role templates in "Hire" dialog
4. Hire a Sector Sourcer — assign the HVAC thesis, set $50 budget
5. Create a ticket assigned to the Sector Sourcer with task:
   "Source 5 HVAC companies in Georgia with $5–20M estimated revenue"
6. Manually trigger a heartbeat (Paperclip has a "Run now" button — find it)
7. Watch the ticket thread fill with agent messages and tool call traces
8. Navigate to `/deal-desk/targets` — see sourced companies with fit scores
9. Navigate to `/deal-desk/memos` — hire the Pipeline Reporter, trigger it,
   verify a memo appears

### 9b. Check for type errors

```bash
pnpm typecheck
```

Fix every error before proceeding.

### 9c. Run the full test suite

```bash
pnpm test
```

Fix any failures introduced by the fork migration.

### 9d. Upstream merge test

Verify the upstream merge path is still clean:
```bash
git fetch upstream-paperclip
git merge upstream-paperclip/master --no-commit --no-ff
# Should show conflicts only in files you explicitly modified
# Should show NO conflicts in:
# - packages/db/ existing files (you only added new migration)
# - server/src/adapters/ (you only added to registry, not modified)
# - packages/shared/ (untouched)
git merge --abort
```

If there are unexpected conflicts in core Paperclip files, fix the fork approach
before shipping. Add `// DEAL DESK:` comments to make future merges clear.

### 9e. Update FORK.md status

At the top of this file, add a completion note:
```
## Status: COMPLETE
Fork of Paperclip master @ [commit hash]
Completed: [date]
Deal Desk additions: [list the 4 new packages/directories added]
Modified Paperclip files: [list every existing Paperclip file touched]
```

### Commit
`chore(fork): migration complete, all checks passing`

---

## What is NOT in scope for this migration

These are all future work. Do not build them during this migration:

- Gmail OAuth / cold outreach sending (infrastructure doesn't exist in Paperclip)
- CRM sync (Affinity, DealCloud, HubSpot)
- Signal monitoring
- Slack/email memo delivery
- Contact enrichment API integrations (Apollo, Hunter) — the tool exists but
  falls back to web search without API keys; that's fine for now
- Mobile-specific UI changes
- Multi-user authentication changes
- Any Paperclip feature not yet released

If you find a `// TODO(v0.2):` comment in Paperclip's code related to something
on this list, leave it alone.

---

## How to handle Paperclip code you don't understand

1. Read the file fully before changing it
2. Search for tests that cover the code you're reading
3. If you must modify a Paperclip file, add `// DEAL DESK:` before every change
4. If something is unclear, add a `// DEAL DESK: TODO — understand this before v0.2` comment
5. Never delete existing Paperclip code — only add

The goal of this migration is a working Deal Desk in 3–5 hours of agent time,
not a perfect codebase. Rough edges are fine. Broken types are not.

---

## Sign-off

When Phase 9 verification passes, write `FORK_REPORT.md` at the repo root:

- Paperclip commit hash you forked from
- List of every existing Paperclip file modified (with reason)
- List of every new file/directory added
- Known issues or TODOs
- Estimated Claude credits consumed
- Instructions for pulling upstream Paperclip updates going forward

Then stop. Do not start v0.2 outreach features.
