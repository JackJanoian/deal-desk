---
slug: dealdesk-create-plugin
name: deal-desk-create-plugin
description: >
  Design DealDesk integrations and workflow extensions for PE sourcing,
  diligence, contact enrichment, intermediary coverage, and reporting. Use when
  connecting external data sources, adding DealDesk tools, or shaping a plugin
  that improves acquisition-target workflow.
domain: deal-desk
required: false
---

# DealDesk Integration Skill

Use this skill when the user asks to add a DealDesk tool, data integration, workflow extension, or plugin-like capability.

The focus is PE workflow value, not generic platform extension. Every integration should improve sourcing, diligence, contact quality, intermediary coverage, or partner reporting.

## Good Integration Candidates

- Company data providers.
- Contact enrichment sources.
- LinkedIn or web research workflows.
- CRM imports/exports.
- Outreach draft repositories.
- Intermediary/deal database connectors.
- Data-room or diligence document summarizers.
- Portfolio or thesis reporting exports.

Avoid building a plugin when a small DealDesk route, seed, field, or UI addition solves the job.

## Discovery Questions

Answer these before proposing implementation:

- Which DealDesk object is affected: thesis, target, contact, intermediary, outreach draft, or report?
- Is the integration read-only, draft-only, or allowed to mutate records?
- What external credentials or secrets are required?
- What is the dedupe key?
- What provenance must be stored?
- What approval boundary applies?
- What failure state should the user see?

## Integration Contract

Any new DealDesk integration should define:

- Input schema.
- Output schema.
- Record mapping.
- Source/citation behavior.
- Idempotency and dedupe behavior.
- Permission and approval boundary.
- Logging or audit trail.
- Retry/failure behavior.

## Data Safety

- Never store raw secrets in DealDesk records.
- Do not send outreach automatically without explicit authorization.
- Tag imported or enriched data with its source.
- Keep confidence separate from facts.
- Prefer staged/draft outputs for anything partner- or counterparty-facing.

## Implementation Guidance

For a small in-app workflow:

1. Add or update the server route under the DealDesk API.
2. Add validation and company scoping.
3. Update the DB schema/migration if new persisted fields are needed.
4. Add UI affordances only where operators need to inspect or approve the output.
5. Add tests around company boundaries, dedupe, and error states.

For a true plugin-style integration:

1. Keep the integration package isolated.
2. Declare only the capabilities required.
3. Keep UI self-contained.
4. Store credentials through the app’s secret/config mechanism.
5. Verify install, runtime execution, and reload behavior.

## Done Criteria

The integration is ready when:

- It improves a specific DealDesk workflow.
- It writes structured records or draft outputs, not just prose.
- It can be re-run without duplicate records.
- It exposes source provenance.
- It fails visibly and recoverably.
- It respects company boundaries and approval requirements.
