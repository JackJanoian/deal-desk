import type { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ddContacts, ddIntermediaries, ddOutreachSends } from "@dealdesk/db";
import type { Db } from "@dealdesk/db";
import { isUuidLike } from "@dealdesk/shared";

function resolveEditedByUserId(req: Request): string | null {
  if (req.actor.type !== "board" || !req.actor.userId) return null;
  return isUuidLike(req.actor.userId) ? req.actor.userId : null;
}

const bodySchema = z
  .object({
    subject: z.string().min(1).max(998).optional(),
    body: z.string().min(1).max(50_000).optional(),
    recipientEmail: z.string().email().max(255).optional(),
  })
  .refine(
    (v) =>
      v.subject !== undefined ||
      v.body !== undefined ||
      v.recipientEmail !== undefined,
    { message: "must provide subject, body, or recipientEmail" },
  );

export function outreachEditHandler(deps: { db: Db }): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ ok: false, reason: parse.error.message });
      return;
    }
    const id = req.params.id as string;
    if (req.actor.type === "none") {
      res.status(401).json({ ok: false, reason: "auth required" });
      return;
    }
    const editedByUserId = resolveEditedByUserId(req);

    const companyId = req.params.companyId as string;
    const existing = await deps.db
      .select({
        id: ddOutreachSends.id,
        status: ddOutreachSends.status,
        contactId: ddOutreachSends.contactId,
        intermediaryId: ddOutreachSends.intermediaryId,
      })
      .from(ddOutreachSends)
      .where(
        and(
          eq(ddOutreachSends.id, id),
          eq(ddOutreachSends.dealDeskCompanyId, companyId),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ ok: false, reason: "send not found" });
      return;
    }
    if (existing[0].status !== "awaiting_approval") {
      res.status(409).json({
        ok: false,
        reason: `can only edit sends in awaiting_approval status (current: ${existing[0].status})`,
      });
      return;
    }

    if (parse.data.recipientEmail !== undefined) {
      if (existing[0].intermediaryId) {
        await deps.db
          .update(ddIntermediaries)
          .set({
            email: parse.data.recipientEmail,
            updatedAt: new Date(),
          })
          .where(eq(ddIntermediaries.id, existing[0].intermediaryId));
      } else if (existing[0].contactId) {
        await deps.db
          .update(ddContacts)
          .set({
            email: parse.data.recipientEmail,
            emailStatus: "unverified",
            updatedAt: new Date(),
          })
          .where(eq(ddContacts.id, existing[0].contactId));
      } else {
        res.status(400).json({ ok: false, reason: "send has no linked recipient" });
        return;
      }
    }

    const patch: Record<string, unknown> = {
      editedAt: new Date(),
      editedByUserId,
    };
    if (parse.data.subject !== undefined) patch.subject = parse.data.subject;
    if (parse.data.body !== undefined) patch.body = parse.data.body;

    await deps.db
      .update(ddOutreachSends)
      .set(patch)
      .where(
        and(
          eq(ddOutreachSends.id, id),
          eq(ddOutreachSends.dealDeskCompanyId, companyId),
          eq(ddOutreachSends.status, "awaiting_approval"),
        ),
      );

    res.status(200).json({ ok: true });
  };
}
