# Deal Desk

> The human control plane for AI deal sourcing.

Run your private equity business development team as a team of AI agents.
Define an investment thesis, hire AI analysts, set budgets, and the system
sources acquisition targets, maps intermediary relationships, and reports
pipeline progress — autonomously.

Open source. Self-hosted. MIT licensed. Built on [Paperclip](https://github.com/paperclipai/paperclip).
Bring your own agent.

## Quick start

```bash
npx dealdesk onboard
# or
npx paperclipai onboard
```

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
