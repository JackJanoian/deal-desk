// DEAL DESK: Tool handler — log a touch with an intermediary and recompute next due date
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddIntermediaries } from "@paperclipai/db";

export const recordIntermediaryTouchInputSchema = z.object({
  intermediaryId: z.string().uuid(),
  touchType: z.string().min(1),
  notes: z.string().min(1),
});

export type RecordIntermediaryTouchInput = z.infer<
  typeof recordIntermediaryTouchInputSchema
>;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function recordIntermediaryTouchHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "Missing companyId in path" });
      return;
    }
    const parseResult = recordIntermediaryTouchInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid input",
        details: parseResult.error.flatten(),
      });
      return;
    }
    const input = parseResult.data;

    const existing = await db.query.ddIntermediaries.findFirst({
      where: and(
        eq(ddIntermediaries.id, input.intermediaryId),
        eq(ddIntermediaries.paperclipCompanyId, companyId),
      ),
    });
    if (!existing) {
      res.status(404).json({ ok: false, reason: "Intermediary not found" });
      return;
    }

    const today = todayDateString();
    const nextDue = addDaysISO(existing.cadenceDays);
    const appendedNotes =
      `${existing.notes ?? ""}\n\n[${today} touch — ${input.touchType}]\n${input.notes}`.trim();

    const updated = await db
      .update(ddIntermediaries)
      .set({
        lastTouchDate: today,
        nextTouchDue: nextDue,
        notes: appendedNotes,
        updatedAt: new Date(),
      })
      .where(eq(ddIntermediaries.id, existing.id))
      .returning();

    const row = updated[0];
    if (!row) {
      res.status(500).json({ ok: false, reason: "Update returned no rows" });
      return;
    }

    res.json({
      ok: true,
      intermediary: {
        id: row.id,
        name: row.name,
        firm: row.firm,
        cadenceDays: row.cadenceDays,
        lastTouchDate: row.lastTouchDate,
        nextTouchDue: row.nextTouchDue,
        notes: row.notes,
      },
    });
  };
}

export function recordIntermediaryTouchRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.post("/", recordIntermediaryTouchHandler(db));
  return router;
}
