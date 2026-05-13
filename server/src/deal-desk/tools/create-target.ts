// DEAL DESK: Tool handler — persist sourced acquisition targets
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddTargets } from "@paperclipai/db";

export const createTargetInputSchema = z.object({
  thesisId: z.string().uuid(),
  companyName: z.string().min(1).max(255),
  website: z.string().url().optional(),
  description: z.string().optional(),
  sector: z.string().optional(),
  subSector: z.string().optional(),
  hqCity: z.string().optional(),
  hqState: z.string().optional(),
  estimatedRevenue: z.number().positive().optional(),
  ownershipType: z.string().optional(),
  fitScore: z.number().int().min(0).max(100),
  fitRationale: z.string().min(10),
  sources: z.array(
    z.object({
      url: z.string(),
      description: z.string(),
    }),
  ),
});

export type CreateTargetInput = z.infer<typeof createTargetInputSchema>;

export type CreateTargetResult =
  | {
      ok: true;
      targetId: string;
      action: "created" | "updated_existing";
      message: string;
    }
  | { ok: false; reason: string };

function headerString(req: Request, name: string): string | undefined {
  const raw = req.header(name);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function createTargetHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const parseResult = createTargetInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid input",
        details: parseResult.error.flatten(),
      });
      return;
    }
    const input = parseResult.data;
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "Missing companyId in path" });
      return;
    }

    if (input.fitScore < 40) {
      const out: CreateTargetResult = {
        ok: false,
        reason:
          "Fit score below 40 — target not saved. Only call createTarget for companies scoring 40 or above.",
      };
      res.status(200).json(out);
      return;
    }

    const agentId = headerString(req, "x-deal-desk-agent-id");
    const issueId = headerString(req, "x-deal-desk-issue-id");

    try {
      const existing = await db.query.ddTargets.findFirst({
        where: and(
          eq(ddTargets.paperclipCompanyId, companyId),
          eq(ddTargets.companyName, input.companyName),
        ),
      });

      if (existing) {
        const appended =
          `${existing.notes ?? ""}\n\n[Re-sourced ${new Date().toISOString()}]\n${input.fitRationale}`.trim();
        await db
          .update(ddTargets)
          .set({ notes: appended, updatedAt: new Date() })
          .where(eq(ddTargets.id, existing.id));

        const out: CreateTargetResult = {
          ok: true,
          targetId: existing.id,
          action: "updated_existing",
          message: "Target already exists — appended new rationale to notes.",
        };
        res.status(200).json(out);
        return;
      }

      const inserted = await db
        .insert(ddTargets)
        .values({
          paperclipCompanyId: companyId,
          thesisId: input.thesisId,
          sourcedByAgentId: agentId,
          sourceTicketId: issueId,
          companyName: input.companyName,
          website: input.website,
          description: input.description,
          sector: input.sector,
          subSector: input.subSector,
          hqCity: input.hqCity,
          hqState: input.hqState,
          estimatedRevenue: input.estimatedRevenue?.toString(),
          ownershipType: input.ownershipType,
          fitScore: input.fitScore,
          fitRationale: input.fitRationale,
          sources: input.sources,
          status: "sourced",
        })
        .returning({ id: ddTargets.id });

      const target = inserted[0];
      if (!target) {
        res.status(500).json({ ok: false, reason: "Insert returned no rows" });
        return;
      }

      const out: CreateTargetResult = {
        ok: true,
        targetId: target.id,
        action: "created",
        message: `Target "${input.companyName}" saved with fit score ${input.fitScore}.`,
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

export function createTargetRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.post("/", createTargetHandler(db));
  return router;
}
