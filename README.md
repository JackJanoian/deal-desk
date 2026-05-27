# DealDesk

> The human control plane for AI deal sourcing.

Run your private equity business development team as a team of AI agents.
Define an investment thesis, hire AI analysts, set budgets, and the system
sources acquisition targets and maps intermediary relationships autonomously.

Open source. Self-hosted. MIT licensed.
Bring your own agent.

## Quick start

```bash
npx dealdesk onboard
```

Then open http://localhost:3100

## How it works

| Step | Action | Example |
|---|---|---|
| **01** | Define your thesis | "HVAC roll-up — Southeast US, $5–25M revenue, founder-owned" |
| **02** | Hire AI analysts | Sector Sourcer, Intermediary Coverage Analyst, Contact Enricher |
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

## Built on DealDesk

This project is a fork of the open-source [DealDesk platform](https://github.com/dealdesk/dealdesk)
for AI company orchestration. We use its heartbeat
engine, adapter system, budget enforcement, and governance layer — and add
PE-specific primitives on top.

## Works with

Claude Code · OpenClaw · Codex · Cursor · Any HTTP endpoint

## Privacy & telemetry

DealDesk is local-first: your thesis, targets, contacts, and all other data
stay in the bundled PostgreSQL database on your machine. Nothing is sent to a
central server as part of normal operation.

Anonymous usage telemetry (install/feature counts, no PII, private references
hashed) is **opt-in and disabled by default**. To turn it on, set
`telemetry.enabled: true` in your config or run with
`DEALDESK_TELEMETRY_ENABLED=1`. Even when enabled, it is disabled in CI and
honors `DO_NOT_TRACK=1` and `DEALDESK_TELEMETRY_DISABLED=1`.

Outbound connections only happen for integrations you explicitly configure
(e.g. Anthropic / your LLM provider, Apollo, Gmail OAuth).

## License

MIT © 2026 DealDesk AI. See [LICENSE](LICENSE) for the full text.

Portions of this software are derived from
[DealDesk](https://github.com/dealdesk/dealdesk) (MIT © 2025 DealDesk AI).
See [NOTICE](NOTICE) for upstream attribution.

Trademarks and logos are not covered by the MIT License. See [TRADEMARK.md](TRADEMARK.md).
