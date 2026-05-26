---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `dealdesk run`

One-command bootstrap and start:

```sh
pnpm dealdesk run
```

Does:

1. Auto-onboards if config is missing
2. Runs `dealdesk doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm dealdesk run --instance dev
```

## `dealdesk onboard`

Interactive first-time setup:

```sh
pnpm dealdesk onboard
```

If DealDesk is already configured, rerunning `onboard` keeps the existing config in place. Use `dealdesk configure` to change settings on an existing install.

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm dealdesk onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm dealdesk onboard --yes
```

On an existing install, `--yes` now preserves the current config and just starts DealDesk with that setup.

## `dealdesk doctor`

Health checks with optional auto-repair:

```sh
pnpm dealdesk doctor
pnpm dealdesk doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration, including AWS Secrets Manager non-secret env
  config when selected
- Storage configuration
- Missing key files

## `dealdesk configure`

Update configuration sections:

```sh
pnpm dealdesk configure --section server
pnpm dealdesk configure --section secrets
pnpm dealdesk configure --section storage
```

`--section secrets` updates the deployment-level provider used as the fallback
for secrets that do not target a specific company vault. Per-company provider
vaults (named instances, default vault selection, multiple vaults per provider,
coming-soon GCP/Vault) live in the board UI under
`Company Settings → Secrets → Provider vaults` and the
`/api/companies/{companyId}/secret-provider-configs` API.

## `dealdesk env`

Show resolved environment configuration:

```sh
pnpm dealdesk env
```

This now includes bind-oriented deployment settings such as `DEALDESK_BIND` and `DEALDESK_BIND_HOST` when configured.

## `dealdesk allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm dealdesk allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.dealdesk/instances/default/config.json` |
| Database | `~/.dealdesk/instances/default/db` |
| Logs | `~/.dealdesk/instances/default/logs` |
| Storage | `~/.dealdesk/instances/default/data/storage` |
| Secrets key | `~/.dealdesk/instances/default/secrets/master.key` |

Override with:

```sh
DEALDESK_HOME=/custom/home DEALDESK_INSTANCE_ID=dev pnpm dealdesk run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm dealdesk run --data-dir ./tmp/dealdesk-dev
pnpm dealdesk doctor --data-dir ./tmp/dealdesk-dev
```
