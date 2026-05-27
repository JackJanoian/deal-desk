---
slug: dealdesk-dev
name: deal-desk-dev
required: false
description: >
  Develop and operate the DealDesk application. Use when changing DealDesk
  routes, schema, seeds, tools, UI pages, Quick Hire behavior, role templates,
  or PE workflow tests.
domain: deal-desk
---

# DealDesk Dev Skill

Use this skill when working on the DealDesk application itself.

DealDesk is a PE-focused layer in this repository. It includes thesis setup, target tracking, intermediary coverage, contact enrichment, role templates, Quick Hire, and DealDesk-specific agent instructions.

## Key Areas

- DB schema: `packages/db/src/schema/deal_desk.ts`
- Server routes: `server/src/routes/deal-desk.ts`
- Server tools: `server/src/deal-desk/tools/`
- Role templates: `server/src/deal-desk/seeds/role-templates.ts`
- Quick Hire UI: `ui/src/pages/deal-desk/QuickHire.tsx`
- DealDesk pages: `ui/src/pages/deal-desk/`
- DealDesk API client: `ui/src/api/dealDesk.ts`
- Tests: `server/src/routes/deal-desk.test.ts`, `packages/db/src/deal-desk.test.ts`, and focused UI tests where available

## Engineering Rules

- Keep every DealDesk entity company-scoped.
- Preserve PE language: thesis, target, intermediary, owner, CEO, contact, outreach draft, pipeline, partner review.
- Prefer structured fields over prose blobs.
- Add migrations for persisted schema changes.
- Keep role templates idempotent through the seeder.
- Do not resurrect retired memo-only flows.
- Keep Quick Hire simple: name, title, instructions, budget, and attached DealDesk skills.

## Development Workflow

1. Read the relevant schema, route, API client, and UI page before editing.
2. Update contracts across DB, server, shared validators/types, and UI together.
3. Add or adjust focused tests around the changed behavior.
4. Run the smallest meaningful verification first.
5. Run typecheck for touched packages before handoff.

## Common Tasks

### Add A DealDesk Field

- Update `packages/db/src/schema/deal_desk.ts`.
- Generate or add the migration.
- Update route serialization and validation.
- Update the UI form/table/card.
- Add DB and route tests.

### Add A DealDesk Tool

- Add the handler under `server/src/deal-desk/tools/`.
- Export/register it in `server/src/deal-desk/tools/index.ts`.
- Enforce company scoping and input validation.
- Return structured output with IDs and warnings.
- Add tests for auth, validation, dedupe, and success.

### Update Role Templates

- Edit `server/src/deal-desk/seeds/role-templates.ts`.
- Keep prompts concise and role-specific.
- Mention relevant DealDesk skills.
- Run server startup/seed tests if touched.

### Update Quick Hire

- Keep the UX minimal.
- Send instructions through `instructionsBundle`, not legacy prompt fields.
- Attach the DealDesk skill set through `desiredSkills`.
- Verify the payload includes budget, role, adapter config, instructions, and desired skills.

## Verification Checklist

Use focused checks that match the change:

```bash
pnpm vitest run server/src/routes/deal-desk.test.ts packages/db/src/deal-desk.test.ts
pnpm --filter server typecheck
pnpm --filter ui typecheck
```

For wider changes, add:

```bash
pnpm test
pnpm build
```

## Handoff Standard

Report:

- What DealDesk workflow changed.
- Which records/routes/UI surfaces are affected.
- Tests and typechecks run.
- Any remaining product or data migration risk.
