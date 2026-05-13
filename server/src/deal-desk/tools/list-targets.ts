// DEAL DESK: Tool handler — list existing targets for a thesis
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddTargets } from "@paperclipai/db";

const targetStatusEnum = z.enum([
  "sourced",
  "qualified",
  "contacted",
  "replied",
  "meeting_booked",
  "in_diligence",
  "passed",
  "closed_won",
  "closed_lost",
]);

export const listTargetsQuerySchema = z.object({
  thesisId: z.string().uuid(),
  status: targetStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListTargetsQuery = z.infer<typeof listTargetsQuerySchema>;

export function listTargetsHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "Missing companyId in path" });
      return;
    }
    const parseResult = listTargetsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid query",
        details: parseResult.error.flatten(),
      });
      return;
    }
    const { thesisId, status, limit } = parseResult.data;

    const whereExpr = status
      ? and(
          eq(ddTargets.paperclipCompanyId, companyId),
          eq(ddTargets.thesisId, thesisId),
          eq(ddTargets.status, status),
        )
      : and(
          eq(ddTargets.paperclipCompanyId, companyId),
          eq(ddTargets.thesisId, thesisId),
        );

    const rows = await db
      .select({
        id: ddTargets.id,
        companyName: ddTargets.companyName,
        website: ddTargets.website,
        fitScore: ddTargets.fitScore,
        status: ddTargets.status,
        hqState: ddTargets.hqState,
        createdAt: ddTargets.createdAt,
      })
      .from(ddTargets)
      .where(whereExpr)
      .orderBy(desc(ddTargets.fitScore))
      .limit(limit);

    res.json({
      count: rows.length,
      targets: rows.map((t) => ({
        id: t.id,
        name: t.companyName,
        website: t.website,
        fitScore: t.fitScore,
        status: t.status,
        state: t.hqState,
        sourcedAt: t.createdAt,
      })),
    });
  };
}

export function listTargetsRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.get("/", listTargetsHandler(db));
  return router;
}
