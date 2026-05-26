import { z } from "zod";
import type { Request, Response, RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddContacts, ddTargets } from "@dealdesk/db";

export const createContactInputSchema = z.object({
  targetId: z.string().uuid(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255).optional(),
  title: z.string().max(255).optional(),
  linkedinUrl: z.string().url().max(2048).optional(),
  isPrimary: z.boolean().default(false),
});

export type CreateContactInput = z.infer<typeof createContactInputSchema>;

export function createContactHandler(db: Db): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const companyId = req.params.companyId as string;
    const parsed = createContactInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const target = await db.query.ddTargets.findFirst({
      where: and(
        eq(ddTargets.id, parsed.data.targetId),
        eq(ddTargets.dealDeskCompanyId, companyId),
      ),
    });
    if (!target) {
      res.status(404).json({ ok: false, reason: "target not found" });
      return;
    }

    if (parsed.data.isPrimary) {
      const existingPrimary = await db.query.ddContacts.findFirst({
        where: and(
          eq(ddContacts.targetId, parsed.data.targetId),
          eq(ddContacts.isPrimary, true),
        ),
      });
      if (existingPrimary) {
        res.status(200).json({ contactId: existingPrimary.id, existing: true });
        return;
      }
    }

    const [row] = await db
      .insert(ddContacts)
      .values({
        dealDeskCompanyId: companyId,
        targetId: parsed.data.targetId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName ?? null,
        title: parsed.data.title ?? null,
        linkedinUrl: parsed.data.linkedinUrl ?? null,
        isPrimary: parsed.data.isPrimary,
        source: "agent",
      })
      .returning({ id: ddContacts.id });

    res.status(201).json({ contactId: row!.id, existing: false });
  };
}
