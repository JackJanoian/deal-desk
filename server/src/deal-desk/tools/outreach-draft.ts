// DEAL DESK: Tool handler — enqueue an outreach email draft for partner approval
import { z } from "zod";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddContacts, ddOutreachSends } from "@dealdesk/db";
import {
  ensureContactEmailFromApollo,
  loadContactForEnrichment,
} from "../enrichment/resolve-contact-email.js";

export const outreachDraftInputSchema = z.object({
  campaignId: z.string().uuid(),
  targetId: z.string().uuid(),
  contactId: z.string().uuid(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  cadenceStep: z.number().int().min(0).default(0),
});

export type OutreachDraftInput = z.infer<typeof outreachDraftInputSchema>;

export interface OutreachDraftDeps {
  db: Db;
  loadApolloKey?: (companyId: string) => Promise<string | null>;
}

function httpStatusForEnrichCode(code: string): number {
  switch (code) {
    case "apollo_plan_blocked":
    case "apollo_credits_exhausted":
    case "missing_contact_fields":
    case "no_email_found":
      return 422;
    case "contact_not_found":
      return 404;
    case "apollo_not_configured":
      return 412;
    default:
      return 502;
  }
}

export function outreachDraftHandler(deps: OutreachDraftDeps) {
  return async (req: Request, res: Response) => {
    const parsed = outreachDraftInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }

    const { campaignId, targetId, contactId, subject, body, cadenceStep } = parsed.data;

    const contact = await loadContactForEnrichment(deps.db, { companyId, contactId });
    if (!contact) {
      res.status(404).json({ ok: false, reason: "Contact not found" });
      return;
    }

    const contactTarget = await deps.db.query.ddContacts.findFirst({
      where: and(eq(ddContacts.id, contactId), eq(ddContacts.targetId, targetId)),
    });
    if (!contactTarget) {
      res.status(422).json({
        ok: false,
        reason: "contactId does not belong to the provided targetId",
      });
      return;
    }

    const loadApolloKey = deps.loadApolloKey ?? (async () => null);
    const apolloKey = await loadApolloKey(companyId);
    if (apolloKey) {
      const enriched = await ensureContactEmailFromApollo({
        db: deps.db,
        companyId,
        contactId,
        loadApolloKey,
        enrichedByAgentId: (req as Request & { agentId?: string }).agentId ?? null,
      });
      if (!enriched.ok) {
        res.status(httpStatusForEnrichCode(enriched.code)).json({
          ok: false,
          reason: enriched.reason,
          code: enriched.code,
        });
        return;
      }
    } else if (!contact.email) {
      res.status(412).json({
        ok: false,
        reason:
          "Contact has no email and Apollo is not configured. Visit /deal-desk/email-accounts to add an Apollo API key.",
        code: "apollo_not_configured",
      });
      return;
    }

    const [row] = await deps.db
      .insert(ddOutreachSends)
      .values({
        dealDeskCompanyId: companyId,
        campaignId,
        targetId,
        contactId,
        subject,
        body,
        cadenceStep,
        status: "awaiting_approval",
        draftedByAgentId: (req as Request & { agentId?: string }).agentId ?? null,
      })
      .returning({ id: ddOutreachSends.id });
    res.status(201).json({ id: row!.id });
  };
}
