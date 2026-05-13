// DEAL DESK: Tool handler — list intermediaries sorted by next touch due
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddIntermediaries } from "@paperclipai/db";

export const listIntermediariesQuerySchema = z.object({
  overdueOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
  sector: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListIntermediariesQuery = z.infer<typeof listIntermediariesQuerySchema>;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function listIntermediariesHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "Missing companyId in path" });
      return;
    }
    const parseResult = listIntermediariesQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid query",
        details: parseResult.error.flatten(),
      });
      return;
    }
    const { overdueOnly, sector, limit } = parseResult.data;
    const today = todayDateString();

    const conds = [eq(ddIntermediaries.paperclipCompanyId, companyId)];
    if (overdueOnly) {
      conds.push(sql`${ddIntermediaries.nextTouchDue} < ${today}`);
    }
    if (sector) {
      // jsonb array contains check
      conds.push(
        sql`${ddIntermediaries.coverageSectors} @> ${JSON.stringify([sector])}::jsonb`,
      );
    }

    const rows = await db
      .select()
      .from(ddIntermediaries)
      .where(and(...conds))
      .orderBy(asc(ddIntermediaries.nextTouchDue))
      .limit(limit);

    res.json({
      count: rows.length,
      intermediaries: rows.map((r) => ({
        id: r.id,
        name: r.name,
        firm: r.firm,
        title: r.title,
        email: r.email,
        linkedinUrl: r.linkedinUrl,
        coverageSectors: r.coverageSectors,
        cadenceDays: r.cadenceDays,
        lastTouchDate: r.lastTouchDate,
        nextTouchDue: r.nextTouchDue,
        isOverdue:
          typeof r.nextTouchDue === "string" && r.nextTouchDue < today,
        relationshipStrength: r.relationshipStrength,
        notes: r.notes,
      })),
    });
  };
}

export function listIntermediariesRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.get("/", listIntermediariesHandler(db));
  return router;
}
