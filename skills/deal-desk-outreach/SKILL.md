---
name: deal-desk-outreach
description: How to draft and queue outreach emails through DealDesk's approval workflow. Use whenever you need to email a target or intermediary.
---

# DealDesk Outreach

You draft outreach emails. You **never send** — every send is queued for the user to approve in the Outreach Approvals UI.

## Prerequisites

Before drafting any outreach, verify a Gmail account is connected:

```
GET /api/companies/{companyId}/deal-desk/tools/email-accounts
```

If `accounts` is empty or all accounts have `revokedAt` set, **stop**. File an issue asking the user to visit `/deal-desk/email-accounts` and click Connect Gmail.

Also verify Apollo enrichment is configured when contact emails are unknown:

```
GET /api/companies/{companyId}/deal-desk/tools/apollo-api-key
```

If `configured` is false, ask the user to add an Apollo API key at `/deal-desk/email-accounts`.

## Contact setup

Create and enrich contacts before drafting:

```
POST /api/companies/{companyId}/deal-desk/tools/contacts
{
  "targetId": "<uuid>",
  "firstName": "Jane",
  "lastName": "Doe",
  "title": "CEO",
  "isPrimary": true
}
```

```
POST /api/companies/{companyId}/deal-desk/tools/contacts/enrich/{contactId}
```

The enrich endpoint requires the target to have a website/domain and the contact to have first and last names.

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

When Apollo is configured, draft auto-enriches the contact and returns **422** if no email can be found.

Response: `201 { "id": "<send-uuid>" }`. The send is now `awaiting_approval`.

## What NOT To Do

- Do not invent contact email addresses. Create contacts and run Apollo enrich instead.
- Do not contact anyone on `dd_suppression_list`.
- Do not call any "send" or "approve" endpoint yourself. Approval is a human-only action.
- Do not draft more than 5 sends per heartbeat without user direction.

## Reporting Back

In chat, summarize: "Drafted N outreach emails awaiting approval at /deal-desk/outreach-approvals."
