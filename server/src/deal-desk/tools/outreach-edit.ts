import type { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { ddOutreachSends } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

const bodySchema = z
  .object({
    subject: z.string().min(1).max(998).optional(),
    body: z.string().min(1).max(50_000).optional(),
  })
  .refine((v) => v.subject !== undefined || v.body !== undefined, {
    message: "must provide subject or body",
  });

export function outreachEditHandler(deps: { db: Db }): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ ok: false, reason: parse.error.message });
      return;
    }
    const id = req.params.id as string;
    const userId =
      (req as Request & { user?: { id?: string } }).user?.id ?? null;
    if (!userId) {
      res.status(401).json({ ok: false, reason: "auth required" });
      return;
    }

    const existing = await deps.db
      .select({ id: ddOutreachSends.id, status: ddOutreachSends.status })
      .from(ddOutreachSends)
      .where(eq(ddOutreachSends.id, id))
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

    const patch: Record<string, unknown> = {
      editedAt: new Date(),
      editedByUserId: userId,
    };
    if (parse.data.subject !== undefined) patch.subject = parse.data.subject;
    if (parse.data.body !== undefined) patch.body = parse.data.body;

    await deps.db
      .update(ddOutreachSends)
      .set(patch)
      .where(eq(ddOutreachSends.id, id));

    res.status(200).json({ ok: true });
  };
}
