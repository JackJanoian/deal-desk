---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that DealDesk uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `DEALDESK_BIND` | `loopback` | Reachability preset: `loopback`, `lan`, `tailnet`, or `custom` |
| `DEALDESK_BIND_HOST` | (unset) | Required when `DEALDESK_BIND=custom` |
| `HOST` | `127.0.0.1` | Legacy host override; prefer `DEALDESK_BIND` for new setups |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `DEALDESK_HOME` | `~/.dealdesk` | Base directory for all DealDesk data |
| `DEALDESK_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `DEALDESK_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |
| `DEALDESK_DEPLOYMENT_EXPOSURE` | `private` | Exposure policy when deployment mode is `authenticated` |
| `DEALDESK_API_URL` | (auto-derived) | DealDesk API base URL. When set externally (e.g., via Kubernetes ConfigMap, load balancer, or reverse proxy), the server preserves the value instead of deriving it from the listen host and port. Useful for deployments where the public-facing URL differs from the local bind address. |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `DEALDESK_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `DEALDESK_SECRETS_MASTER_KEY_FILE` | `~/.dealdesk/.../secrets/master.key` | Path to key file |
| `DEALDESK_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `DEALDESK_AGENT_ID` | Agent's unique ID |
| `DEALDESK_COMPANY_ID` | Company ID |
| `DEALDESK_API_URL` | DealDesk API base URL (inherits the server-level value; see Server Configuration above) |
| `DEALDESK_API_KEY` | Short-lived JWT for API auth |
| `DEALDESK_RUN_ID` | Current heartbeat run ID |
| `DEALDESK_TASK_ID` | Issue that triggered this wake |
| `DEALDESK_WAKE_REASON` | Wake trigger reason |
| `DEALDESK_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `DEALDESK_APPROVAL_ID` | Resolved approval ID |
| `DEALDESK_APPROVAL_STATUS` | Approval decision |
| `DEALDESK_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |
