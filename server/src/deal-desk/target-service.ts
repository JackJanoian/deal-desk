// DEAL DESK: Shared target create/update/get logic for board routes and agent tools.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@dealdesk/db";
import { ddTargets } from "@dealdesk/db";

export const targetStatusValues = [
  "sourced",
  "qualified",
  "contacted",
  "replied",
  "meeting_booked",
  "in_diligence",
  "passed",
  "closed_won",
  "closed_lost",
] as const;

export type TargetStatus = (typeof targetStatusValues)[number];

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
  sources: z
    .array(
      z.object({
        url: z.string(),
        description: z.string(),
      }),
    )
    .default([]),
});

export type CreateTargetInput = z.infer<typeof createTargetInputSchema>;

export const updateTargetInputSchema = z.object({
  status: z.enum(targetStatusValues).optional(),
  notes: z.string().nullable().optional(),
  fitScore: z.number().int().min(0).max(100).optional(),
  fitRationale: z.string().min(1).optional(),
  sector: z.string().nullable().optional(),
  subSector: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  hqCity: z.string().nullable().optional(),
  hqState: z.string().nullable().optional(),
  ownershipType: z.string().nullable().optional(),
});

export type UpdateTargetInput = z.infer<typeof updateTargetInputSchema>;

export type CreateTargetResult =
  | {
      ok: true;
      targetId: string;
      action: "created" | "updated_existing";
      message: string;
    }
  | { ok: false; reason: string };

export type UpdateTargetResult =
  | { ok: true; target: typeof ddTargets.$inferSelect }
  | { ok: false; reason: string; status?: number };

export async function createTarget(
  db: Db,
  companyId: string,
  input: CreateTargetInput,
  attribution?: { agentId?: string; issueId?: string },
): Promise<CreateTargetResult> {
  if (input.fitScore < 40) {
    return {
      ok: false,
      reason:
        "Fit score below 40 — target not saved. Only save companies scoring 40 or above.",
    };
  }

  const existing = await db.query.ddTargets.findFirst({
    where: and(
      eq(ddTargets.dealDeskCompanyId, companyId),
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

    return {
      ok: true,
      targetId: existing.id,
      action: "updated_existing",
      message: "Target already exists — appended new rationale to notes.",
    };
  }

  const inserted = await db
    .insert(ddTargets)
    .values({
      dealDeskCompanyId: companyId,
      thesisId: input.thesisId,
      sourcedByAgentId: attribution?.agentId ?? null,
      sourceTicketId: attribution?.issueId ?? null,
      companyName: input.companyName,
      website: input.website ?? null,
      description: input.description ?? null,
      sector: input.sector ?? null,
      subSector: input.subSector ?? null,
      hqCity: input.hqCity ?? null,
      hqState: input.hqState ?? null,
      estimatedRevenue: input.estimatedRevenue?.toString() ?? null,
      ownershipType: input.ownershipType ?? null,
      fitScore: input.fitScore,
      fitRationale: input.fitRationale,
      sources: input.sources,
      status: "sourced",
      statusChangedAt: new Date(),
    })
    .returning({ id: ddTargets.id });

  const target = inserted[0];
  if (!target) {
    return { ok: false, reason: "Insert returned no rows" };
  }

  return {
    ok: true,
    targetId: target.id,
    action: "created",
    message: `Target "${input.companyName}" saved with fit score ${input.fitScore}.`,
  };
}

export async function getTarget(
  db: Db,
  companyId: string,
  targetId: string,
): Promise<(typeof ddTargets.$inferSelect) | null> {
  const row = await db.query.ddTargets.findFirst({
    where: and(
      eq(ddTargets.dealDeskCompanyId, companyId),
      eq(ddTargets.id, targetId),
    ),
  });
  return row ?? null;
}

export async function updateTarget(
  db: Db,
  companyId: string,
  targetId: string,
  input: UpdateTargetInput,
): Promise<UpdateTargetResult> {
  const existing = await getTarget(db, companyId, targetId);
  if (!existing) {
    return { ok: false, reason: "Target not found", status: 404 };
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (input.status !== undefined) {
    updateValues.status = input.status;
    updateValues.statusChangedAt = new Date();
  }
  if (input.notes !== undefined) updateValues.notes = input.notes;
  if (input.fitScore !== undefined) updateValues.fitScore = input.fitScore;
  if (input.fitRationale !== undefined) updateValues.fitRationale = input.fitRationale;
  if (input.sector !== undefined) updateValues.sector = input.sector;
  if (input.subSector !== undefined) updateValues.subSector = input.subSector;
  if (input.website !== undefined) updateValues.website = input.website;
  if (input.description !== undefined) updateValues.description = input.description;
  if (input.hqCity !== undefined) updateValues.hqCity = input.hqCity;
  if (input.hqState !== undefined) updateValues.hqState = input.hqState;
  if (input.ownershipType !== undefined) updateValues.ownershipType = input.ownershipType;

  const [updated] = await db
    .update(ddTargets)
    .set(updateValues)
    .where(
      and(
        eq(ddTargets.dealDeskCompanyId, companyId),
        eq(ddTargets.id, targetId),
      ),
    )
    .returning();

  if (!updated) {
    return { ok: false, reason: "Update failed", status: 500 };
  }

  return { ok: true, target: updated };
}

export type PipelineSummary = {
  total: number;
  byStatus: Record<TargetStatus, number>;
};

export async function getPipelineSummary(
  db: Db,
  companyId: string,
  thesisId: string,
): Promise<PipelineSummary> {
  const rows = await db
    .select({
      status: ddTargets.status,
      count: sql<number>`count(*)::int`,
    })
    .from(ddTargets)
    .where(
      and(
        eq(ddTargets.dealDeskCompanyId, companyId),
        eq(ddTargets.thesisId, thesisId),
      ),
    )
    .groupBy(ddTargets.status);

  const byStatus = Object.fromEntries(
    targetStatusValues.map((s) => [s, 0]),
  ) as Record<TargetStatus, number>;

  let total = 0;
  for (const row of rows) {
    byStatus[row.status as TargetStatus] = row.count;
    total += row.count;
  }

  return { total, byStatus };
}
