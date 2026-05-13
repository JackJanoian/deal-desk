// DEAL DESK: Tool handler — save banker/broker contacts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddIntermediaries } from "@paperclipai/db";

export const createIntermediaryInputSchema = z.object({
  name: z.string().min(1).max(255),
  firm: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email().optional(),
  linkedinUrl: z.string().url().optional(),
  coverageSectors: z.array(z.string()).default([]),
  recentDeals: z
    .array(z.object({ description: z.string(), year: z.number().int() }))
    .default([]),
  notes: z.string().optional(),
  cadenceDays: z.number().int().min(1).max(365).default(60),
});

export type CreateIntermediaryInput = z.infer<typeof createIntermediaryInputSchema>;

export type CreateIntermediaryResult =
  | {
      ok: true;
      intermediaryId: string;
      action: "created" | "updated_existing";
      message: string;
    }
  | { ok: false; reason: string };

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createIntermediaryHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "Missing companyId in path" });
      return;
    }
    const parseResult = createIntermediaryInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid input",
        details: parseResult.error.flatten(),
      });
      return;
    }
    const input = parseResult.data;

    try {
      // Dedup on (companyId, name, firm)
      const firmCond = input.firm
        ? eq(ddIntermediaries.firm, input.firm)
        : sql`${ddIntermediaries.firm} IS NULL`;
      const existing = await db.query.ddIntermediaries.findFirst({
        where: and(
          eq(ddIntermediaries.paperclipCompanyId, companyId),
          eq(ddIntermediaries.name, input.name),
          firmCond,
        ),
      });

      if (existing) {
        const out: CreateIntermediaryResult = {
          ok: true,
          intermediaryId: existing.id,
          action: "updated_existing",
          message: "Intermediary already tracked — no changes applied.",
        };
        res.status(200).json(out);
        return;
      }

      const inserted = await db
        .insert(ddIntermediaries)
        .values({
          paperclipCompanyId: companyId,
          name: input.name,
          firm: input.firm,
          title: input.title,
          email: input.email,
          linkedinUrl: input.linkedinUrl,
          coverageSectors: input.coverageSectors,
          recentDeals: input.recentDeals,
          notes: input.notes,
          cadenceDays: input.cadenceDays,
          nextTouchDue: addDaysISO(input.cadenceDays),
          lastTouchDate: todayDateString(),
        })
        .returning({ id: ddIntermediaries.id });

      const row = inserted[0];
      if (!row) {
        res.status(500).json({ ok: false, reason: "Insert returned no rows" });
        return;
      }

      const out: CreateIntermediaryResult = {
        ok: true,
        intermediaryId: row.id,
        action: "created",
        message: `Intermediary "${input.name}" saved.`,
      };
      res.status(201).json(out);
    } catch (error) {
      res.status(500).json({
        ok: false,
        reason: `Database error: ${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  };
}

export function createIntermediaryRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.post("/", createIntermediaryHandler(db));
  return router;
}
