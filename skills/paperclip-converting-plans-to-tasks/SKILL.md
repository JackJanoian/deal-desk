---
slug: paperclip-converting-plans-to-tasks
name: deal-desk-converting-plans-to-tasks
description: >
  Convert a Deal Desk sourcing, diligence, or coverage plan into executable
  private-equity workstreams. Use when breaking an investment thesis, pipeline
  cleanup effort, intermediary coverage campaign, or diligence plan into
  assigned Deal Desk tasks with clear dependencies and success criteria.
domain: deal-desk
required: false
---

# Deal Desk — Converting Plans To Tasks

Use this skill to turn a Deal Desk plan into work that agents can execute without re-asking what to do.

The goal is not to create a beautiful plan. The goal is to create a clean operating graph: each task has an owner, a concrete deliverable, the right Deal Desk records to update, and real blockers.

## Inputs To Gather

Before creating tasks, identify:

- Active thesis or mandate.
- Target sectors, geography, revenue range, and ownership signals.
- Current pipeline gaps.
- Intermediary coverage gaps.
- Diligence questions or partner decisions.
- Available Deal Desk employees and their specialties.

If the plan lacks enough detail for an assignee to act, add a first task to clarify the missing input rather than creating vague research tickets.

## Task Types

Use these task categories:

- **Sourcing slice**: find companies in a defined sector/geography/size band.
- **Pipeline cleanup**: dedupe, normalize stages, update stale records, or add missing citations.
- **Contact enrichment**: identify owners, CEOs, founders, bankers, brokers, or advisors.
- **Intermediary coverage**: map relationships, draft check-ins, and schedule next touches.
- **Diligence question**: answer a focused market, customer, financial, or competitive question.
- **Partner review**: summarize evidence and ask for a decision.
- **Tooling gap**: request or implement missing Deal Desk workflow support.

## Decomposition Rules

- One task should produce one inspectable result.
- Give each task a Deal Desk object to update when possible: thesis, target, intermediary, contact, outreach draft, or pipeline summary.
- Use dependencies for real ordering constraints. Do not serialize work that can run in parallel.
- Assign by specialty. A sourcer should source; a contact enricher should enrich; Head of BD should orchestrate and summarize.
- Call out missing employees or skills as a staffing gap instead of assigning mismatched work.

## Task Template

Each task should include:

```markdown
## Goal
What business outcome this task supports.

## Scope
Sector/geography/revenue/stage/contact/intermediary boundaries.

## Inputs
Thesis, existing records, source lists, or partner notes to use.

## Deliverable
Exact Deal Desk record updates or summary expected.

## Quality Bar
Citation, dedupe, scoring, confidence, and approval requirements.

## Blockers
Any tasks or partner decisions that must happen first.
```

## Common Workstream Patterns

### New Thesis Launch

1. Normalize the thesis into searchable criteria.
2. Create sourcing slices by sector and geography.
3. Assign target sourcing in parallel.
4. Assign intermediary mapping in parallel.
5. After initial targets exist, assign contact enrichment.
6. Head of BD summarizes pipeline coverage and gaps.

### Pipeline Quality Sprint

1. Deduplicate target records.
2. Add missing citations and score rationales.
3. Re-score stale or weak targets.
4. Enrich top-priority contacts.
5. Summarize which records are partner-ready.

### Coverage Campaign

1. Segment intermediaries by relevance and freshness.
2. Draft overdue check-ins.
3. Add missing intermediary profiles.
4. Surface relationship gaps for partner review.

## Done Criteria

A task breakdown is ready when:

- Every task has an owner or explicitly states a staffing gap.
- Each task has a concrete Deal Desk deliverable.
- Dependencies are represented as blockers, not buried in prose.
- Partner approval points are explicit.
- No task asks an agent to fabricate data, send outreach without approval, or bypass Deal Desk records.
