// DEAL DESK: Enqueue an intermediary check-in email draft for partner approval.
import { z } from "zod";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddIntermediaries, ddOutreachSends } from "@dealdesk/db";
import { getOrCreateIntermediaryCheckInCampaign } from "../intermediary-campaign.js";

export const intermediaryOutreachDraftInputSchema = z.object({
  intermediaryId: z.string().uuid(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
});

export type IntermediaryOutreachDraftInput = z.infer<
  typeof intermediaryOutreachDraftInputSchema
>;

export function intermediaryOutreachDraftHandler(deps: { db: Db }) {
  return async (req: Request, res: Response) => {
    const parsed = intermediaryOutreachDraftInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid input",
        details: parsed.error.flatten(),
      });
      return;
    }

    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "companyId required" });
      return;
    }

    const { intermediaryId, subject, body } = parsed.data;

    const intermediary = await deps.db.query.ddIntermediaries.findFirst({
      where: and(
        eq(ddIntermediaries.id, intermediaryId),
        eq(ddIntermediaries.dealDeskCompanyId, companyId),
      ),
    });
    if (!intermediary) {
      res.status(404).json({ ok: false, reason: "Intermediary not found" });
      return;
    }
    if (!intermediary.email?.trim()) {
      res.status(422).json({
        ok: false,
        reason: "Intermediary has no email — add one before drafting outreach",
      });
      return;
    }

    const campaignId = await getOrCreateIntermediaryCheckInCampaign(deps.db, companyId);

    const [row] = await deps.db
      .insert(ddOutreachSends)
      .values({
        dealDeskCompanyId: companyId,
        campaignId,
        intermediaryId,
        subject,
        body,
        cadenceStep: 0,
        status: "awaiting_approval",
        draftedByAgentId: (req as Request & { agentId?: string }).agentId ?? null,
      })
      .returning({ id: ddOutreachSends.id });

    res.status(201).json({ ok: true, id: row!.id });
  };
}
