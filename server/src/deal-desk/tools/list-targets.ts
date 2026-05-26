// DEAL DESK: Tool handler — list existing targets for a thesis
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { ddTargets } from "@dealdesk/db";
import { targetStatusValues } from "../target-service.js";

export const listTargetsQuerySchema = z.object({
  thesisId: z.string().uuid(),
  status: z.enum(targetStatusValues).optional(),
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
          eq(ddTargets.dealDeskCompanyId, companyId),
          eq(ddTargets.thesisId, thesisId),
          eq(ddTargets.status, status),
        )
      : and(
          eq(ddTargets.dealDeskCompanyId, companyId),
          eq(ddTargets.thesisId, thesisId),
        );

    const rows = await db
      .select({
        id: ddTargets.id,
        companyName: ddTargets.companyName,
        website: ddTargets.website,
        sector: ddTargets.sector,
        fitScore: ddTargets.fitScore,
        fitRationale: ddTargets.fitRationale,
        status: ddTargets.status,
        hqState: ddTargets.hqState,
        notes: ddTargets.notes,
        statusChangedAt: ddTargets.statusChangedAt,
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
        sector: t.sector,
        fitScore: t.fitScore,
        fitRationale: t.fitRationale,
        status: t.status,
        state: t.hqState,
        notes: t.notes,
        statusChangedAt: t.statusChangedAt,
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
