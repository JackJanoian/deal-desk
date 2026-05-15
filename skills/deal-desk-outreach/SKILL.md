---
name: deal-desk-outreach
description: How to draft and queue outreach emails through Deal Desk's approval workflow. Use whenever you need to email a target or intermediary.
---

# Deal Desk Outreach

You draft outreach emails. You **never send** — every send is queued for the user to approve in the Outreach Approvals UI.

## Prerequisites

Before drafting any outreach, verify a Gmail account is connected:

```
GET /api/companies/{companyId}/deal-desk/tools/email-accounts
```

If `accounts` is empty or all accounts have `revokedAt` set, **stop**. File an issue asking the user to visit `/deal-desk/email-accounts` and click Connect Gmail.

## Drafting a Send

```
POST /api/companies/{companyId}/deal-desk/tools/outreach/draft
Content-Type: application/json

{
  "campaignId": "<uuid>",
  "targetId": "<uuid>",
  "contactId": "<uuid>",
  "subject": "Subject line under 80 chars",
  "body": "Email body. Plain text. Under 150 words. Personalized."
}
```

Response: `201 { "id": "<send-uuid>" }`. The send is now `awaiting_approval`.

## What NOT To Do

- Do not invent contact email addresses. Pull them from `dd_contacts`.
- Do not contact anyone on `dd_suppression_list`.
- Do not call any "send" or "approve" endpoint yourself. Approval is a human-only action.
- Do not draft more than 5 sends per heartbeat without user direction.

## Reporting Back

In chat, summarize: "Drafted N outreach emails awaiting approval at /deal-desk/outreach-approvals."
