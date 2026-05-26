// DEAL DESK: Tool handler — enrich a contact via Apollo.io when an API key is configured.
import type { Request, Response, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { ddContacts } from "@dealdesk/db";
import type { Db } from "@dealdesk/db";
import {
  ensureContactEmailFromApollo,
  resolveContactEmail,
} from "../enrichment/resolve-contact-email.js";
import { z } from "zod";

export const enrichContactInputSchema = z.object({
  targetId: z.string().uuid().optional(),
  titlesToSearch: z.array(z.string().min(1)).optional(),
});

export type EnrichContactInput = z.infer<typeof enrichContactInputSchema>;

export interface EnrichContactDeps {
  db: Db;
  loadApolloKey: (companyId: string) => Promise<string | null>;
}

function resolveEnrichedByAgentId(req: Request): string | null {
  const agentId = (req as Request & { agentId?: string }).agentId;
  return agentId ?? null;
}

export function enrichContactHandler(deps: EnrichContactDeps): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const companyId = (req.params.companyId as string | undefined) ?? "";
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }

    const contactId = req.params.contactId as string;
    if (!contactId) {
      res.status(400).json({ ok: false, reason: "contactId param required" });
      return;
    }

    const apiKey = await deps.loadApolloKey(companyId);
    if (!apiKey) {
      res.status(412).json({
        ok: false,
        reason:
          "Apollo.io API key not configured for this company. " +
          "Visit /deal-desk/email-accounts to set it up.",
        code: "apollo_not_configured",
      });
      return;
    }

    const resolved = await resolveContactEmail({
      db: deps.db,
      companyId,
      contactId,
      loadApolloKey: deps.loadApolloKey,
    });

    if (!resolved.ok) {
      const status =
        resolved.code === "contact_not_found"
          ? 404
          : resolved.code === "missing_contact_fields" ||
              resolved.code === "no_email_found"
            ? 422
            : resolved.code === "apollo_plan_blocked" ||
                resolved.code === "apollo_credits_exhausted"
              ? 422
              : resolved.code === "apollo_lookup_failed"
                ? 502
                : 412;
      if (resolved.code === "no_email_found") {
        res.status(200).json({ ok: false, reason: resolved.reason, code: resolved.code });
        return;
      }
      res.status(status).json({ ok: false, reason: resolved.reason, code: resolved.code });
      return;
    }

    await deps.db
      .update(ddContacts)
      .set({
        email: resolved.email,
        emailStatus: resolved.emailStatus,
        source: "apollo",
        enrichedAt: new Date(),
        enrichedByAgentId: resolveEnrichedByAgentId(req),
        updatedAt: new Date(),
      })
      .where(eq(ddContacts.id, contactId));

    res.status(200).json({
      ok: true,
      email: resolved.email,
      emailStatus: resolved.emailStatus,
      code: "apollo_enriched",
    });
  };
}

export { ensureContactEmailFromApollo, resolveContactEmail };
