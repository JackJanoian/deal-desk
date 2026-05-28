<p align="center">
  <img width="1472" height="1088" alt="DealDesk" src="https://github.com/user-attachments/assets/aafd10ae-e667-462f-939c-b44cd65c07d6" />
</p>

<p align="center">
  <a href="#quickstart"><strong>Quickstart</strong></a> &middot;
  <a href="https://github.com/JackJanoian/deal-desk"><strong>GitHub</strong></a> &middot;
  <a href="https://www.npmjs.com/package/dealdesk"><strong>npm</strong></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/dealdesk"><img src="https://img.shields.io/npm/v/dealdesk?label=npm" alt="npm version" /></a>
  <a href="https://github.com/JackJanoian/deal-desk/stargazers"><img src="https://img.shields.io/github/stars/JackJanoian/deal-desk?style=flat" alt="Stars" /></a>
</p>

<br/>

# DealDesk is the app private equity firms use to manage AI analysts for deal sourcing.
<img width="1015" height="563" alt="Screenshot 2026-05-28 at 4 06 26 PM" src="https://github.com/user-attachments/assets/9c9c63fe-97e4-4dd7-b192-a5f87f19ee71" />

Open-source orchestration for teams of AI analysts working a thesis.

**If your associate is an _employee_, DealDesk is the _deal team_.**

Inspired by Paperclip, DealDesk is a Node.js server and React UI that orchestrates a team of AI analysts to source acquisition targets. Bring your own agents, define an investment thesis, and track sourced targets, intermediary coverage, and outreach from one dashboard.

It looks like a deal pipeline. Under the hood: investment theses, target tracking, intermediary maps, contact enrichment, outreach drafting, governance, and analyst coordination.

**Manage investment theses, not spreadsheets.**

|        | Step                 | Example                                                                                |
| ------ | -------------------- | -------------------------------------------------------------------------------------- |
| **01** | Define the thesis    | _"HVAC roll-up — Southeast US, $5–25M revenue, founder-owned, 15%+ EBITDA margins."_   |
| **02** | Hire the deal team   | Sector Sourcer, Intermediary Coverage Analyst, Contact Enricher, Outreach Drafter.     |
| **03** | Approve and run      | Review targets. Set budgets. Hit go. Monitor the pipeline from the dashboard.          |

<br/>

<div align="center">
  <em>Works with Claude Code · Codex · Cursor · OpenClaw · any HTTP endpoint.</em><br/>
  <em>If it can receive a heartbeat, it's on the deal team.</em>
</div>

<br/>

## DealDesk is right for you if

- ✅ You run a **private equity, search fund, or family office** doing thesis-driven sourcing
- ✅ You want to **coordinate many AI analysts** (Claude, Codex, Cursor, custom) toward a sector thesis
- ✅ You're juggling **20 Claude tabs** for company research and lose track of which target is which
- ✅ You want analysts running **autonomously 24/7** screening targets, but still want partner review before outreach
- ✅ You want to **monitor costs per analyst** and enforce monthly budgets
- ✅ You want a process that **feels like a deal pipeline**, not a folder of scripts
- ✅ You want to **monitor your pipeline from your phone**

<br/>

## Features

<table>
<tr>
<td align="center" width="33%">
<h3>🎯 Thesis-Driven Sourcing</h3>
Every target traces back to an investment thesis. Analysts know <em>what</em> to source and <em>why</em>.
</td>
<td align="center" width="33%">
<h3>🔌 Bring Your Own Agent</h3>
Any agent, any runtime, one deal team. Claude Code, Codex, Cursor, HTTP — if it can receive a heartbeat, it's hired.
</td>
<td align="center" width="33%">
<h3>💓 Heartbeats</h3>
Analysts wake on a schedule, screen the universe, and surface targets. Delegation flows up to partners and down to enrichers.
</td>
</tr>
<tr>
<td align="center">
<h3>🏦 Intermediary Coverage</h3>
Map bankers, brokers, and advisors per sector. Track relationships, last touch, and active processes.
</td>
<td align="center">
<h3>📇 Contact Enrichment</h3>
Owner, CEO, and key-person enrichment per target with structured fields, not prose blobs.
</td>
<td align="center">
<h3>✉️ Outreach Drafting</h3>
Analysts draft personalized intermediary and target outreach. Board approves before sends go out.
</td>
</tr>
<tr>
<td align="center">
<h3>💰 Cost Control</h3>
Monthly budgets per analyst. When they hit the limit, they stop. No runaway LLM bills.
</td>
<td align="center">
<h3>🛡️ Governance</h3>
Approve outreach sends, override strategy, pause or terminate any analyst — at any time.
</td>
<td align="center">
<h3>🏢 Multi-Fund</h3>
One deployment, many funds or strategies. Complete data isolation across vehicles.
</td>
</tr>
</table>

<br/>

## Problems DealDesk solves

| Without DealDesk                                                                                                                       | With DealDesk                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ❌ You have 20 Claude tabs open researching companies and can't track which target belongs to which thesis. On reboot you lose everything. | ✅ Targets are ticket-based, scoped to a thesis. Conversations are threaded. Sessions persist across reboots.                              |
| ❌ You manually paste your thesis into every prompt to remind the bot what you're actually screening for.                              | ✅ Thesis context flows from the target up through the strategy — your analyst always knows the screen criteria and why.                  |
| ❌ Folders of prompts and CSVs are disorganized — you're re-inventing CRM, ticketing, and analyst coordination from scratch.            | ✅ DealDesk gives you a pipeline, intermediary map, contact roster, and governance out of the box — so you run a deal team, not a pile of scripts. |
| ❌ One runaway research loop burns $400 of tokens overnight before you notice.                                                          | ✅ Cost tracking surfaces token budgets per analyst and throttles them when they're out. Partners prioritize with budgets.                 |
| ❌ Recurring sourcing work (weekly intermediary outreach, market scans, list refreshes) is forgotten or done inconsistently.            | ✅ Heartbeats handle recurring sourcing on a schedule. Partners supervise the queue.                                                       |
| ❌ You have a thesis idea, you have to spin up a research project, keep a tab open, and babysit it.                                    | ✅ Define the thesis in DealDesk. Your sourcing analyst works it until the pipeline fills. Partners review the targets.                    |

<br/>

## Why DealDesk is special

DealDesk handles the hard orchestration details correctly.

|                                  |                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Atomic execution.**            | Target checkout and budget enforcement are atomic, so no double-research and no runaway spend.                           |
| **Persistent analyst state.**    | Analysts resume the same target context across heartbeats instead of re-screening from scratch.                          |
| **PE-native data model.**        | Thesis, target, intermediary, owner, CEO, contact, outreach draft, pipeline stage, partner review — first-class entities. |
| **Structured fields over prose.** | Targets, contacts, and intermediaries are structured records, not memo blobs. Filterable, exportable, syncable.         |
| **Governance with rollback.**    | Approval gates are enforced on outreach sends; config changes are revisioned; bad changes can be rolled back safely.     |
| **Thesis-aware execution.**      | Every target carries full thesis ancestry so analysts consistently see the screen criteria, not just a company name.    |
| **True multi-fund isolation.**   | Every entity is company-scoped, so one deployment can run many funds or strategies with separate data and audit trails. |

<br/>

## What's under the hood

DealDesk is a full deal-sourcing control plane, not a thin wrapper.

```
┌──────────────────────────────────────────────────────────────┐
│                      DEALDESK SERVER                         │
│                                                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │  Thesis & │  │  Targets  │  │ Heartbeat │  │Governance │  │
│  │  Strategy │  │ & Pipeline│  │ Execution │  │& Approvals│  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
│                                                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Deal Team │  │Intermediary  │ Contact   │  │  Budget   │  │
│  │ & Roles   │  │  Coverage │  │Enrichment │  │ & Costs   │  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
│                                                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │  Outreach │  │ Secrets & │  │ Activity  │  │  Fund     │  │
│  │  Drafts   │  │  Storage  │  │ & Audit   │  │Portability│  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
└──────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲              ▲
   ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
   │  Claude   │  │   Codex   │  │   CLI     │  │ HTTP/web  │
   │   Code    │  │           │  │  agents   │  │   bots    │
   └───────────┘  └───────────┘  └───────────┘  └───────────┘
```

### The systems

<table>
<tr>
<td width="50%">

**Thesis & Strategy** — Investment theses are first-class records: sector, geography, revenue band, margin band, ownership profile, and exclusions. Every target, outreach, and analyst run carries the thesis it serves.

</td>
<td width="50%">

**Deal Team & Roles** — Analysts have roles, titles, reporting lines, and budgets. The seeded role templates (Sector Sourcer, Intermediary Coverage Analyst, Contact Enricher, Outreach Drafter, Pipeline Manager) are the starting deal team; Quick Hire adds custom roles in seconds.

</td>
</tr>
<tr>
<td>

**Targets & Pipeline** — Targets are tickets scoped to a thesis with structured fields (revenue, EBITDA, owner, headquarters, fit score), pipeline stage, comments, work products, and an immutable audit trail. No double-sourcing, no lost context.

</td>
<td>

**Heartbeat Execution** — DB-backed wakeup queue with coalescing, budget checks, workspace resolution, secret injection, skill loading, and adapter invocation. Each run produces structured logs, cost events, session state, and audit trails. Orphan recovery is automatic.

</td>
</tr>
<tr>
<td>

**Intermediary Coverage** — Bankers, brokers, and advisors are first-class records with sector tags, last-touch tracking, active processes, and relationship owners. Coverage analysts keep the map fresh on a heartbeat.

</td>
<td>

**Contact Enrichment** — Owner, CEO, and key-person enrichment per target. Structured fields for name, title, email, phone, and source. Dedupe is enforced; warnings surface up to the partner.

</td>
</tr>
<tr>
<td>

**Outreach Drafts** — Analysts draft personalized intermediary and target outreach. Drafts are queued, reviewed by board actors, and only sent after explicit approval. Gmail OAuth is the default send path.

</td>
<td>

**Governance & Approvals** — Outreach approval workflows, execution policies with review stages, decision tracking, budget hard-stops, analyst pause/resume/terminate, and full audit logging. Nothing leaves the firm without your sign-off.

</td>
</tr>
<tr>
<td>

**Budget & Cost Control** — Token and cost tracking by fund, analyst, thesis, target, provider, and model. Scoped budget policies with warning thresholds and hard stops. Overspend pauses analysts and cancels queued work automatically.

</td>
<td>

**Activity & Audit** — Mutating actions, heartbeat state changes, cost events, approvals, comments, and outreach sends are recorded as durable activity so partners can audit what happened and why.

</td>
</tr>
</table>

<br/>

## What DealDesk is not

|                              |                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Not a CRM.**               | It syncs to yours — Affinity, DealCloud, HubSpot — rather than replacing it.                                                     |
| **Not an agent runtime.**    | Bring your own (Claude Code, Codex, Cursor, OpenClaw, HTTP). DealDesk orchestrates the team they work on.                        |
| **Not a data provider.**     | Connect your own enrichment (Apollo, Hunter, ZoomInfo, web search). DealDesk routes the calls and tracks the cost.               |
| **Not a chat interface.**    | Analysts work through structured tickets, not chat windows. The pipeline is the product.                                         |
| **Not a workflow builder.**  | No drag-and-drop pipelines. DealDesk models a PE sourcing org — with theses, targets, intermediaries, budgets, and governance.    |
| **Not a single-analyst tool.** | This is for teams. If you have one analyst, you probably don't need DealDesk. If you have a sector sweep going — you do.        |

<br/>

## Quickstart

Open source. Self-hosted. No DealDesk account required.

```bash
npx dealdesk@latest onboard
```

Then open <http://localhost:3100>.

Rerunning `onboard` keeps existing config in place. Use `dealdesk configure` to edit settings.

Or manually:

```bash
git clone https://github.com/JackJanoian/deal-desk.git
cd deal-desk
pnpm install
pnpm dev
```

This starts the API server at `http://localhost:3100`. An embedded PostgreSQL database is created automatically — no setup required.

> **Requirements:** Node.js 20+, pnpm 9.15+

<br/>

## FAQ

**What does a typical setup look like?**
Locally, a single Node.js process manages an embedded Postgres and local file storage. For production, point it at your own Postgres and deploy however you like. Define your thesis, hire analysts from the role templates (or build your own), and the team takes over.

**Can I run multiple funds or strategies?**
Yes. A single deployment can run an unlimited number of funds with complete data isolation. Useful if you run multiple theses, a fund-of-one, or a search fund umbrella.

**How is DealDesk different from Claude Code or Codex on their own?**
DealDesk _uses_ those agents. It orchestrates them into a deal team — with theses, intermediary maps, target pipelines, budgets, and governance. Claude Code researches a company; DealDesk runs the screen.

**Do analysts run continuously?**
By default, analysts run on scheduled heartbeats and event-based triggers (new target, partner review request). You can also wire in continuous agents. You bring the agent; DealDesk coordinates the work.

**Does DealDesk replace my CRM?**
No. DealDesk is the upstream sourcing layer. Push qualified targets into Affinity, DealCloud, or HubSpot when they're ready for the IC.

<br/>

## Development

```bash
pnpm dev              # Full dev (API + UI, watch mode)
pnpm dev:once         # Full dev without file watching
pnpm dev:server       # Server only
pnpm build            # Build all
pnpm typecheck        # Type checking
pnpm test             # Cheap default test run (Vitest only)
pnpm test:watch       # Vitest watch mode
pnpm test:e2e         # Playwright browser suite
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

`pnpm test` does not run Playwright. Browser suites stay separate and are typically run only when working on those flows or in CI.

See [doc/DEVELOPING.md](doc/DEVELOPING.md) for the full development guide.

<br/>

## Roadmap

- ✅ Investment thesis as a first-class entity
- ✅ Target tracking with structured PE fields
- ✅ Intermediary coverage map
- ✅ Contact / owner / CEO enrichment
- ✅ Outreach drafts with board approval gates
- ✅ Gmail OAuth send path
- ✅ Quick Hire for custom analyst roles
- ✅ Scheduled heartbeats and budgets
- ⚪ CRM sync (Affinity, DealCloud, HubSpot)
- ⚪ LinkedIn Sales Navigator integration

See [ROADMAP.md](ROADMAP.md) for the full roadmap.

<br/>

## Privacy & telemetry

DealDesk is **local-first**: your thesis, targets, contacts, intermediaries, and outreach drafts stay in the bundled PostgreSQL database on your machine. Nothing is sent to a central server as part of normal operation.

Anonymous usage telemetry (install / feature counts, no PII, private references hashed) is **opt-in and disabled by default**. To turn it on:

| Method               | How                                                  |
| -------------------- | ---------------------------------------------------- |
| Environment variable | `DEALDESK_TELEMETRY_ENABLED=1`                       |
| Config file          | Set `telemetry.enabled: true` in your DealDesk config |

Even when enabled, telemetry is disabled in CI (`CI=true`) and honors `DO_NOT_TRACK=1` and `DEALDESK_TELEMETRY_DISABLED=1`.

Outbound network calls only happen for integrations you explicitly configure (LLM provider, enrichment provider, Gmail OAuth).

<br/>

## Contributing

We welcome contributions. See the [contributing guide](CONTRIBUTING.md) for details.

<br/>

## License

MIT &copy; 2026 DealDesk AI. See [LICENSE](LICENSE) for the full text.

Trademarks and logos are not covered by the MIT License. See [TRADEMARK.md](TRADEMARK.md).

<br/>

---

<p align="center">
  <sub>Open source under MIT. Built for deal teams who want to source theses, not babysit prompts.</sub>
</p>
