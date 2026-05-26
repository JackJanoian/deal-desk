# CLI Reference

DealDesk CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`, `env-lab`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm dealdesk --help
```

First-time local bootstrap + run:

```sh
pnpm dealdesk run
```

Choose local instance:

```sh
pnpm dealdesk run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `dealdesk onboard` and `dealdesk configure --section server` set deployment mode in config
- server onboarding/configure ask for reachability intent and write `server.bind`
- `dealdesk run --bind <loopback|lan|tailnet>` passes a quickstart bind preset into first-run onboarding when config is missing
- runtime can override mode with `DEALDESK_DEPLOYMENT_MODE`
- `dealdesk run` and `dealdesk doctor` still do not expose a direct low-level `--mode` flag

Canonical behavior is documented in `doc/DEPLOYMENT-MODES.md`.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm dealdesk allowed-hostname dotta-macbook-pro
```

Bring up the default local SSH fixture for environment testing:

```sh
pnpm dealdesk env-lab up
pnpm dealdesk env-lab doctor
pnpm dealdesk env-lab status --json
pnpm dealdesk env-lab down
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.dealdesk`:

```sh
pnpm dealdesk run --data-dir ./tmp/paperclip-dev
pnpm dealdesk issue list --data-dir ./tmp/paperclip-dev
```

## Context Profiles

Store local defaults in `~/.dealdesk/context.json`:

```sh
pnpm dealdesk context set --api-base http://localhost:3100 --company-id <company-id>
pnpm dealdesk context show
pnpm dealdesk context list
pnpm dealdesk context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm dealdesk context set --api-key-env-var-name DEALDESK_API_KEY
export DEALDESK_API_KEY=...
```

## Company Commands

```sh
pnpm dealdesk company list
pnpm dealdesk company get <company-id>
pnpm dealdesk company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm dealdesk company delete PAP --yes --confirm PAP
pnpm dealdesk company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `DEALDESK_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `DEALDESK_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm dealdesk issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm dealdesk issue get <issue-id-or-identifier>
pnpm dealdesk issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm dealdesk issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm dealdesk issue comment <issue-id> --body "..." [--reopen]
pnpm dealdesk issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm dealdesk issue release <issue-id>
```

## Agent Commands

```sh
pnpm dealdesk agent list --company-id <company-id>
pnpm dealdesk agent get <agent-id>
pnpm dealdesk agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a DealDesk agent:

- creates a new long-lived agent API key
- installs missing DealDesk skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `DEALDESK_API_URL`, `DEALDESK_COMPANY_ID`, `DEALDESK_AGENT_ID`, and `DEALDESK_API_KEY`

Example for shortname-based local setup:

```sh
pnpm dealdesk agent local-cli codexcoder --company-id <company-id>
pnpm dealdesk agent local-cli claudecoder --company-id <company-id>
```

## Secrets Commands

```sh
pnpm dealdesk secrets list --company-id <company-id>
pnpm dealdesk secrets declarations --company-id <company-id> [--include agents,projects] [--kind secret]
pnpm dealdesk secrets create --company-id <company-id> --name anthropic-api-key --value-env ANTHROPIC_API_KEY
pnpm dealdesk secrets link --company-id <company-id> --name prod-stripe-key --provider aws_secrets_manager --external-ref <provider-ref>
pnpm dealdesk secrets doctor --company-id <company-id>
pnpm dealdesk secrets migrate-inline-env --company-id <company-id> [--apply]
```

Secret listing and declarations never print secret values. `create` accepts
`--value-env` so shell history does not capture the value. `link` records
provider-owned references without copying the secret value into DealDesk.
For AWS-backed secrets, `secrets doctor` reports missing non-secret provider
env and the expected AWS SDK runtime credential source; do not store AWS
bootstrap credentials in DealDesk secrets.

Per-company provider vaults (multiple vault instances per provider, default
vault selection, coming-soon GCP/Vault) are configured from the board UI under
`Company Settings → Secrets → Provider vaults` or through
`/api/companies/{companyId}/secret-provider-configs`. There is no CLI surface
for vault management today. See the
[secrets deploy guide](../docs/deploy/secrets.md#provider-vaults) and
[API reference](../docs/api/secrets.md#provider-vaults) for the contract.

## Approval Commands

```sh
pnpm dealdesk approval list --company-id <company-id> [--status pending]
pnpm dealdesk approval get <approval-id>
pnpm dealdesk approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm dealdesk approval approve <approval-id> [--decision-note "..."]
pnpm dealdesk approval reject <approval-id> [--decision-note "..."]
pnpm dealdesk approval request-revision <approval-id> [--decision-note "..."]
pnpm dealdesk approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm dealdesk approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm dealdesk activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm dealdesk dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm dealdesk heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Local DealDesk data lives under the selected instance root. `DEALDESK_HOME` chooses the home directory and `DEALDESK_INSTANCE_ID` chooses the instance.

```text
~/.dealdesk/                                     # DEALDESK_HOME
└── instances/
    └── default/                                  # instance root (DEALDESK_INSTANCE_ID)
        ├── config.json                           # runtime config
        ├── .env                                  # instance env file
        ├── db/                                   # embedded PostgreSQL data
        ├── data/
        │   ├── storage/                          # local_disk uploads
        │   └── backups/                          # automatic DB backups
        ├── logs/
        ├── secrets/
        │   └── master.key                        # local_encrypted master key
        ├── workspaces/                           # default agent workspaces
        ├── projects/                             # project execution workspaces
        ├── companies/                            # per-company adapter homes (e.g. codex-home)
        └── codex-home/                           # per-instance codex home (when not company-scoped)
```

Default paths for the canonical install:

- config: `~/.dealdesk/instances/default/config.json`
- embedded db: `~/.dealdesk/instances/default/db`
- logs: `~/.dealdesk/instances/default/logs`
- storage: `~/.dealdesk/instances/default/data/storage`
- secrets key: `~/.dealdesk/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
DEALDESK_HOME=/custom/home DEALDESK_INSTANCE_ID=dev pnpm dealdesk run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm dealdesk configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
