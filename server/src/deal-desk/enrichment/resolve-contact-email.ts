import { and, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddContacts, ddTargets } from "@dealdesk/db";
import {
  ApolloApiError,
  resolvePersonEmail,
  type ApolloEmailStatus,
} from "./apollo-client.js";

export type ResolveContactEmailErrorCode =
  | "apollo_not_configured"
  | "contact_not_found"
  | "company_mismatch"
  | "missing_contact_fields"
  | "apollo_master_key_required"
  | "apollo_plan_blocked"
  | "apollo_credits_exhausted"
  | "apollo_lookup_failed"
  | "no_email_found";

export type ResolveContactEmailSuccess = {
  ok: true;
  email: string;
  emailStatus: ApolloEmailStatus;
  source: "apollo";
  apolloPersonId?: string | null;
  contactId: string;
  firstName: string;
  lastName: string;
  companyDomain: string;
};

export type ResolveContactEmailFailure = {
  ok: false;
  reason: string;
  code: ResolveContactEmailErrorCode;
};

export type ResolveContactEmailResult = ResolveContactEmailSuccess | ResolveContactEmailFailure;

export interface ResolveContactEmailDeps {
  db: Db;
  companyId: string;
  contactId: string;
  loadApolloKey: (companyId: string) => Promise<string | null>;
  resolvePersonEmailFn?: typeof resolvePersonEmail;
}

function extractCompanyDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname;
  } catch {
    return website;
  }
}

export async function loadContactForEnrichment(
  db: Db,
  args: { companyId: string; contactId: string },
): Promise<
  | {
      id: string;
      dealDeskCompanyId: string;
      firstName: string;
      lastName: string | null;
      title: string | null;
      email: string | null;
      source: string | null;
      emailStatus: string;
      companyDomain: string | null;
    }
  | null
> {
  const rows = await db
    .select({
      id: ddContacts.id,
      dealDeskCompanyId: ddContacts.dealDeskCompanyId,
      firstName: ddContacts.firstName,
      lastName: ddContacts.lastName,
      title: ddContacts.title,
      email: ddContacts.email,
      source: ddContacts.source,
      emailStatus: ddContacts.emailStatus,
      website: ddTargets.website,
    })
    .from(ddContacts)
    .innerJoin(ddTargets, eq(ddContacts.targetId, ddTargets.id))
    .where(
      and(
        eq(ddContacts.id, args.contactId),
        eq(ddContacts.dealDeskCompanyId, args.companyId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    dealDeskCompanyId: row.dealDeskCompanyId,
    firstName: row.firstName,
    lastName: row.lastName,
    title: row.title,
    email: row.email,
    source: row.source,
    emailStatus: row.emailStatus,
    companyDomain: extractCompanyDomain(row.website),
  };
}

export function contactNeedsApolloEnrichment(contact: {
  email: string | null;
  source: string | null;
  emailStatus: string;
}): boolean {
  if (!contact.email) return true;
  // Only Apollo-sourced emails are trusted as-is; anything else gets Apollo-verified.
  if (contact.source !== "apollo") return true;
  return contact.emailStatus === "unverified";
}

export async function resolveContactEmail(
  deps: ResolveContactEmailDeps,
): Promise<ResolveContactEmailResult> {
  const resolveFn = deps.resolvePersonEmailFn ?? resolvePersonEmail;
  const apiKey = await deps.loadApolloKey(deps.companyId);
  if (!apiKey) {
    return {
      ok: false,
      code: "apollo_not_configured",
      reason:
        "Apollo.io API key not configured for this company. Visit /deal-desk/email-accounts to set it up.",
    };
  }

  const contact = await loadContactForEnrichment(deps.db, {
    companyId: deps.companyId,
    contactId: deps.contactId,
  });

  if (!contact) {
    return {
      ok: false,
      code: "contact_not_found",
      reason: "contact not found",
    };
  }

  if (contact.dealDeskCompanyId !== deps.companyId) {
    return {
      ok: false,
      code: "company_mismatch",
      reason: "contact does not belong to this company",
    };
  }

  if (!contact.firstName || !contact.lastName || !contact.companyDomain) {
    return {
      ok: false,
      code: "missing_contact_fields",
      reason: "contact missing firstName, lastName, or target company website/domain",
    };
  }

  let match;
  try {
    match = await resolveFn({
      firstName: contact.firstName,
      lastName: contact.lastName,
      companyDomain: contact.companyDomain,
      title: contact.title ?? undefined,
      apiKey,
    });
  } catch (err) {
    if (err instanceof ApolloApiError) {
      if (err.code === "apollo_plan_blocked") {
        return {
          ok: false,
          code: "apollo_plan_blocked",
          reason:
            "Apollo cannot reveal emails on this plan. Upgrade at https://app.apollo.io/ or add a verified email manually.",
        };
      }
      if (err.code === "apollo_master_key_required") {
        return {
          ok: false,
          code: "apollo_master_key_required",
          reason:
            "Apollo requires a Master API key for enrichment. Create one at https://app.apollo.io/#/settings/integrations/api",
        };
      }
      if (err.code === "apollo_credits_exhausted") {
        return {
          ok: false,
          code: "apollo_credits_exhausted",
          reason:
            "Apollo enrichment credits exhausted. Add credits at https://app.apollo.io/ or add a verified email manually.",
        };
      }
    }
    const message = err instanceof Error ? err.message : "Apollo lookup failed";
    return {
      ok: false,
      code: "apollo_lookup_failed",
      reason: message,
    };
  }

  if (!match.email) {
    return {
      ok: false,
      code: "no_email_found",
      reason: `No email found for ${contact.firstName} ${contact.lastName} at ${contact.companyDomain}`,
    };
  }

  return {
    ok: true,
    email: match.email,
    emailStatus: match.emailStatus ?? "unverified",
    source: "apollo",
    apolloPersonId: match.apolloPersonId ?? null,
    contactId: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    companyDomain: contact.companyDomain,
  };
}

export async function persistResolvedContactEmail(
  db: Db,
  args: {
    contactId: string;
    email: string;
    emailStatus: ApolloEmailStatus;
    enrichedByAgentId?: string | null;
  },
): Promise<void> {
  await db
    .update(ddContacts)
    .set({
      email: args.email,
      emailStatus: args.emailStatus,
      source: "apollo",
      enrichedAt: new Date(),
      enrichedByAgentId: args.enrichedByAgentId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(ddContacts.id, args.contactId));
}

export async function ensureContactEmailFromApollo(
  deps: ResolveContactEmailDeps & { enrichedByAgentId?: string | null },
): Promise<
  | { ok: true; email: string; emailStatus: ApolloEmailStatus; enriched: boolean }
  | ResolveContactEmailFailure
> {
  const contact = await loadContactForEnrichment(deps.db, {
    companyId: deps.companyId,
    contactId: deps.contactId,
  });

  if (!contact) {
    return {
      ok: false,
      code: "contact_not_found",
      reason: "contact not found",
    };
  }

  if (!contactNeedsApolloEnrichment(contact)) {
    return {
      ok: true,
      email: contact.email!,
      emailStatus: contact.emailStatus as ApolloEmailStatus,
      enriched: false,
    };
  }

  const resolved = await resolveContactEmail(deps);
  if (!resolved.ok) {
    return resolved;
  }

  await persistResolvedContactEmail(deps.db, {
    contactId: resolved.contactId,
    email: resolved.email,
    emailStatus: resolved.emailStatus,
    enrichedByAgentId: deps.enrichedByAgentId ?? null,
  });

  return {
    ok: true,
    email: resolved.email,
    emailStatus: resolved.emailStatus,
    enriched: true,
  };
}
