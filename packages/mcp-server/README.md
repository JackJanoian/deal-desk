# DealDesk MCP Server

Model Context Protocol server for DealDesk.

This package is a thin MCP wrapper over the existing DealDesk REST API. It does
not talk to the database directly and it does not reimplement business logic.

## Authentication

The server reads its configuration from environment variables:

- `DEALDESK_API_URL` - DealDesk base URL, for example `http://localhost:3100`
- `DEALDESK_API_KEY` - bearer token used for `/api` requests
- `DEALDESK_COMPANY_ID` - optional default company for company-scoped tools
- `DEALDESK_AGENT_ID` - optional default agent for checkout helpers
- `DEALDESK_RUN_ID` - optional run id forwarded on mutating requests

## Usage

```sh
npx -y @dealdesk/mcp-server
```

Or locally in this repo:

```sh
pnpm --filter @dealdesk/mcp-server build
node packages/mcp-server/dist/stdio.js
```

## Tool Surface

Read tools:

- `dealdeskMe`
- `dealdeskInboxLite`
- `dealdeskListAgents`
- `dealdeskGetAgent`
- `dealdeskListIssues`
- `dealdeskGetIssue`
- `dealdeskGetHeartbeatContext`
- `dealdeskListComments`
- `dealdeskGetComment`
- `dealdeskListIssueApprovals`
- `dealdeskListDocuments`
- `dealdeskGetDocument`
- `dealdeskListDocumentRevisions`
- `dealdeskListProjects`
- `dealdeskGetProject`
- `dealdeskGetIssueWorkspaceRuntime`
- `dealdeskWaitForIssueWorkspaceService`
- `dealdeskListGoals`
- `dealdeskGetGoal`
- `dealdeskListApprovals`
- `dealdeskGetApproval`
- `dealdeskGetApprovalIssues`
- `dealdeskListApprovalComments`

Write tools:

- `dealdeskCreateIssue`
- `dealdeskUpdateIssue`
- `dealdeskCheckoutIssue`
- `dealdeskReleaseIssue`
- `dealdeskAddComment`
- `dealdeskSuggestTasks`
- `dealdeskAskUserQuestions`
- `dealdeskRequestConfirmation`
- `dealdeskUpsertIssueDocument`
- `dealdeskRestoreIssueDocumentRevision`
- `dealdeskControlIssueWorkspaceServices`
- `dealdeskCreateApproval`
- `dealdeskLinkIssueApproval`
- `dealdeskUnlinkIssueApproval`
- `dealdeskApprovalDecision`
- `dealdeskAddApprovalComment`

Escape hatch:

- `dealdeskApiRequest`

`dealdeskApiRequest` is limited to paths under `/api` and JSON bodies. It is
meant for endpoints that do not yet have a dedicated MCP tool.
