# Apollo Contact Enrichment

DealDesk uses your company's Apollo.io API key to find recipient email addresses before outreach sends go out.

## Setup

1. Open **Email Accounts** at `/deal-desk/email-accounts`.
2. Paste your Apollo API key under **Apollo.io enrichment**.
3. Save the key. DealDesk validates whether your plan supports email reveal.

## How enrichment runs

Apollo lookup happens automatically at three points:

1. **Draft** — `POST /api/companies/:companyId/deal-desk/tools/outreach/draft` enriches the contact when an Apollo key is configured. Drafts without a deliverable email are rejected.
2. **Approve** — `POST .../outreach/sends/:id/approve` re-enriches when the contact email is missing or not sourced from Apollo (including manual overrides).
3. **Manual / agent** — `POST .../contacts/enrich/:contactId` or the **Look up with Apollo** button on Outreach Approvals.

## Contact workflow

1. Create a contact: `POST .../contacts` with `{ targetId, firstName, lastName, title?, isPrimary? }`
2. Enrich: `POST .../contacts/enrich/:contactId`
3. Draft outreach: `POST .../outreach/draft`

Agents should never invent email addresses.

## Apollo plan requirements

- **Email reveal** requires a paid Apollo plan with enrichment credits. DealDesk uses `people/match` first, then `mixed_people/api_search` + `people/bulk_match` as a fallback.
- **Free-tier keys** may pass search validation but cannot reveal emails. The Email Accounts page shows **Search only — upgrade for email reveal** when this happens.

## Error codes

| Code | Meaning |
|------|---------|
| `apollo_not_configured` | No Apollo key saved for the company |
| `apollo_plan_blocked` | Current Apollo plan cannot access enrichment endpoints |
| `apollo_credits_exhausted` | Apollo credits are exhausted |
| `no_email_found` | Apollo did not return an email for the contact |
| `missing_contact_fields` | Contact needs first name, last name, and target website/domain |

## UI surfaces

- **Email Accounts** — configure Gmail and Apollo
- **Outreach Approvals** — review drafts, run Apollo lookup, approve sends
