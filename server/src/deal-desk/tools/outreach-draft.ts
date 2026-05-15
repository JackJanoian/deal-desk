// DEAL DESK: Tool handler — enqueue an outreach email draft for partner approval
import { z } from "zod";
import type { Request, Response } from "express";
import type { Db } from "@paperclipai/db";
import { ddOutreachSends } from "@paperclipai/db";

export const outreachDraftInputSchema = z.object({
  campaignId: z.string().uuid(),
  targetId: z.string().uuid(),
  contactId: z.string().uuid(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  cadenceStep: z.number().int().min(0).default(0),
});

export type OutreachDraftInput = z.infer<typeof outreachDraftInputSchema>;

export function outreachDraftHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const parsed = outreachDraftInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const companyId = req.params.companyId as string | undefined;
    const { campaignId, targetId, contactId, subject, body, cadenceStep } = parsed.data;
    const [row] = await db
      .insert(ddOutreachSends)
      .values({
        paperclipCompanyId: companyId ?? "",
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
