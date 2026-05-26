---
slug: dealdesk-create-agent
name: deal-desk-create-agent
description: >
  Hire or configure Deal Desk employees such as Sector Sourcers, Contact
  Enrichers, Intermediary Coverage Analysts, Heads of BD, and custom PE
  analysts. Use when creating a Deal Desk agent, choosing a role template,
  drafting AGENTS.md instructions, or applying Deal Desk skills to a new hire.
domain: deal-desk
required: false
---

# Deal Desk Create Agent Skill

Use this skill when the user asks to hire, create, or configure a Deal Desk employee.

The output should be a PE-relevant agent with clear role boundaries, Deal Desk skills attached, and instructions that update the application records rather than producing disconnected prose.

## Default Skill Set

Deal Desk hires should receive these skills unless the user asks for a narrower configuration:

- `dealdesk`
- `dealdesk-converting-plans-to-tasks`
- `dealdesk-create-agent`
- `dealdesk-create-plugin`
- `dealdesk-dev`

These keys are intentionally preserved for compatibility, but their content is Deal Desk-specific.

## Role Selection

Prefer an existing Deal Desk role template when possible:

- **Sector Sourcer**: finds and scores acquisition targets.
- **Contact Enricher**: identifies owners, CEOs, founders, bankers, brokers, and advisors.
- **Intermediary Coverage Analyst**: maps and drafts relationship touches.
- **Head of BD**: decomposes mandates, delegates work, and summarizes pipeline health.
- **Custom Employee**: use when the role is fund-specific or outside the defaults.

If the requested role does not match a template, state the closest template and what you changed.

## Hiring Inputs

Collect or infer conservatively:

- Name and title.
- Reporting line, if the company has an org structure.
- Role mandate and boundaries.
- Adapter type and execution settings.
- Monthly budget.
- Whether scheduled heartbeats are needed.
- Which Deal Desk skills to attach.
- Instructions bundle content.

Leave scheduled heartbeats off unless the role truly needs recurring work. Sourcing and enrichment roles often do; one-off analysts often do not.

## Instruction Requirements

Every Deal Desk agent instruction bundle should include:

- The active fund/thesis context if known.
- The exact Deal Desk records the agent may update.
- Dedupe and citation rules.
- Outreach approval boundary.
- Fit scoring guidance.
- Completion/reporting expectations.
- The attached Deal Desk skills and when to use each one.

Avoid broad platform-maintenance instructions unless the role is explicitly a Deal Desk app developer/operator.

## Quick Hire Payload Shape

When creating a Deal Desk agent through the app/API, include:

```json
{
  "name": "Atlanta HVAC Sourcer",
  "title": "Sector Sourcer",
  "role": "general",
  "adapterType": "claude_local",
  "adapterConfig": {
    "dangerouslySkipPermissions": true
  },
  "desiredSkills": [
    "dealdesk",
    "dealdesk-converting-plans-to-tasks",
    "dealdesk-create-agent",
    "dealdesk-create-plugin",
    "dealdesk-dev"
  ],
  "instructionsBundle": {
    "entryFile": "AGENTS.md",
    "files": {
      "AGENTS.md": "You are a senior PE sourcing analyst..."
    }
  },
  "budgetMonthlyCents": 5000
}
```

Use `role: "general"` for PE employees when the app’s authorization path expects non-CEO operational roles.

## Quality Checklist

Before creating the hire, confirm:

- The role has a specific PE mandate.
- The agent knows which Deal Desk records to read and update.
- The desired skill list includes the converted Deal Desk skills.
- The instructions forbid duplicate targets and fabricated data.
- Outreach is draft-only unless the user explicitly authorizes sending.
- The budget and heartbeat cadence match the job.
- The user can review or approve sensitive actions.

## After Creation

Report:

- Agent name and role.
- Attached Deal Desk skills.
- Budget and heartbeat posture.
- First recommended task or mandate.
- Any missing thesis/context needed before useful work begins.
