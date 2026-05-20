// DEAL DESK: Tool handler — enrich a contact via Apollo.io when an API key is configured.
import type { Request, Response, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { ddContacts, ddTargets } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { apolloMatchPerson } from "../enrichment/apollo-client.js";
import { z } from "zod";

// ── Input schema (preserved for agents calling this endpoint via HTTP body) ──
// targetId + titlesToSearch are kept so existing agent tool definitions don't
// need updating. New callers supply contactId via the route param instead.
export const enrichContactInputSchema = z.object({
  targetId: z.string().uuid().optional(),
  titlesToSearch: z.array(z.string().min(1)).optional(),
});

export type EnrichContactInput = z.infer<typeof enrichContactInputSchema>;

// ── Handler deps ─────────────────────────────────────────────────────────────

export interface EnrichContactDeps {
  db: Db;
  loadApolloKey: (companyId: string) => Promise<string | null>;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export function enrichContactHandler(deps: EnrichContactDeps): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    // companyId arrives via route param from the parent company-scoped router
    const companyId = (req.params.companyId as string | undefined) ?? "";
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }

    const apiKey = await deps.loadApolloKey(companyId);
    if (!apiKey) {
      res.status(412).json({
        ok: false,
        reason:
          "Apollo.io API key not configured for this company. " +
          "Visit /deal-desk/email-accounts to set it up.",
      });
      return;
    }

    const contactId = req.params.contactId as string;
    if (!contactId) {
      res.status(400).json({ ok: false, reason: "contactId param required" });
      return;
    }

    // Join through dd_targets to get the company website (used as domain for Apollo)
    const rows = await deps.db
      .select({
        id: ddContacts.id,
        firstName: ddContacts.firstName,
        lastName: ddContacts.lastName,
        domain: ddTargets.website, // full URL; we extract hostname below
      })
      .from(ddContacts)
      .innerJoin(ddTargets, eq(ddContacts.targetId, ddTargets.id))
      .where(eq(ddContacts.id, contactId))
      .limit(1);

    const contact = rows[0];
    if (!contact) {
      res.status(404).json({ ok: false, reason: "contact not found" });
      return;
    }

    // Extract bare hostname from the website URL (e.g. "https://acme.com" → "acme.com")
    let companyDomain: string | null = null;
    if (contact.domain) {
      try {
        companyDomain = new URL(contact.domain).hostname;
      } catch {
        // Not a valid URL — use as-is (may already be a bare domain)
        companyDomain = contact.domain;
      }
    }

    if (!contact.firstName || !contact.lastName || !companyDomain) {
      res.status(422).json({
        ok: false,
        reason: "contact missing firstName, lastName, or company domain",
      });
      return;
    }

    const match = await apolloMatchPerson({
      firstName: contact.firstName,
      lastName: contact.lastName,
      companyDomain,
      apiKey,
    });

    if (!match.email) {
      res.status(200).json({ ok: false, reason: "no email found" });
      return;
    }

    await deps.db
      .update(ddContacts)
      .set({
        email: match.email,
        emailStatus: match.emailStatus ?? "unverified",
        source: "apollo",
        enrichedAt: new Date(),
      })
      .where(eq(ddContacts.id, contactId));

    res.status(200).json({
      ok: true,
      email: match.email,
      emailStatus: match.emailStatus,
    });
  };
}
