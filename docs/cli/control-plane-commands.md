---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm dealdesk issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm dealdesk issue get <issue-id-or-identifier>

# Create issue
pnpm dealdesk issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm dealdesk issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm dealdesk issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm dealdesk issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm dealdesk issue release <issue-id>
```

## Company Commands

```sh
pnpm dealdesk company list
pnpm dealdesk company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm dealdesk company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm dealdesk company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
pnpm dealdesk company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm dealdesk agent list
pnpm dealdesk agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm dealdesk approval list [--status pending]

# Get approval
pnpm dealdesk approval get <approval-id>

# Create approval
pnpm dealdesk approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm dealdesk approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm dealdesk approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm dealdesk approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm dealdesk approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm dealdesk approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm dealdesk activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm dealdesk dashboard get
```

## Heartbeat

```sh
pnpm dealdesk heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
