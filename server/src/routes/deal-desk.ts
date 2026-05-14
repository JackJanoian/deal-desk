// DEAL DESK: PE-specific API routes. Mounted at /api/companies and scoped by
// :companyId. Auth comes from the global actorMiddleware applied to /api in
// app.ts; per-route authorization uses assertCompanyAccess to mirror
// server/src/routes/companies.ts.

import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  ddTheses,
  ddTargets,
  ddIntermediaries,
  ddRoleTemplates,
} from "@paperclipai/db";

import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { dealDeskToolsRouter } from "../deal-desk/tools/index.js";

// Mirror dd_target_status enum values (server/db enum is the source of truth).
const targetStatusValues = [
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
const targetStatusEnum = z.enum(targetStatusValues);

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v))
  .nullable()
  .optional();

// DEAL DESK: v0.3 — small attached text files on a thesis (jsonb on dd_theses.attachments)
const attachmentSchema = z.array(
  z.object({
    name: z.string().min(1).max(255),
    mime: z.string().min(1).max(100),
    sizeBytes: z.number().int().nonnegative().max(50_000),
    content: z.string().max(100_000),
  }),
).max(5).optional();

const createThesisSchema = z.object({
  name: z.string().min(1).max(255),
  sector: z.string().min(1).max(255),
  subSectors: z.array(z.string()).optional().default([]),
  geos: z.array(z.string()).optional().default([]),
  revenueMin: decimalString,
  revenueMax: decimalString,
  ebitdaMin: decimalString,
  ebitdaMax: decimalString,
  dealSizeMin: decimalString,
  dealSizeMax: decimalString,
  ownershipPreferences: z.array(z.string()).optional().default([]),
  exclusionCriteria: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
  templateSlug: z.string().max(255).nullable().optional(),
  attachments: attachmentSchema,
});

const updateTargetStatusSchema = z.object({
  status: targetStatusEnum,
});

// DEAL DESK: Phase 6 v0.2 — edit thesis input schema. All fields optional
// (partial update). Numerics accept number|string|null and pass through; the
// handler stringifies for Drizzle's numeric() type.
const updateThesisSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sector: z.string().min(1).max(255).optional(),
  subSectors: z.array(z.string()).optional(),
  geos: z.array(z.string()).optional(),
  revenueMin: decimalString,
  revenueMax: decimalString,
  ebitdaMin: decimalString,
  ebitdaMax: decimalString,
  dealSizeMin: decimalString,
  dealSizeMax: decimalString,
  ownershipPreferences: z.array(z.string()).optional(),
  exclusionCriteria: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
  templateSlug: z.string().max(255).nullable().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  attachments: attachmentSchema,
});

export function dealDeskRoutes(db: Db) {
  const router = Router({ mergeParams: true });

  // ── Theses ────────────────────────────────────────────────────────────────
  router.post(
    "/:companyId/deal-desk/theses",
    validate(createThesisSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = req.body as z.infer<typeof createThesisSchema>;
      const [row] = await db
        .insert(ddTheses)
        .values({
          paperclipCompanyId: companyId,
          name: body.name,
          sector: body.sector,
          subSectors: body.subSectors ?? [],
          geos: body.geos ?? [],
          revenueMin: body.revenueMin ?? null,
          revenueMax: body.revenueMax ?? null,
          ebitdaMin: body.ebitdaMin ?? null,
          ebitdaMax: body.ebitdaMax ?? null,
          dealSizeMin: body.dealSizeMin ?? null,
          dealSizeMax: body.dealSizeMax ?? null,
          ownershipPreferences: body.ownershipPreferences ?? [],
          exclusionCriteria: body.exclusionCriteria ?? null,
          narrative: body.narrative ?? null,
          templateSlug: body.templateSlug ?? null,
          attachments: body.attachments ?? [],
        })
        .returning();

      res.status(201).json(row);
    },
  );

  router.get("/:companyId/deal-desk/theses", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const rows = await db
      .select()
      .from(ddTheses)
      .where(eq(ddTheses.paperclipCompanyId, companyId))
      .orderBy(desc(ddTheses.createdAt));
    res.json(rows);
  });

  router.get(
    "/:companyId/deal-desk/theses/:thesisId",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const thesisId = req.params.thesisId as string;
      assertCompanyAccess(req, companyId);
      const [row] = await db
        .select()
        .from(ddTheses)
        .where(
          and(
            eq(ddTheses.paperclipCompanyId, companyId),
            eq(ddTheses.id, thesisId),
          ),
        )
        .limit(1);
      if (!row) {
        res.status(404).json({ error: "Thesis not found" });
        return;
      }
      res.json(row);
    },
  );

  // DEAL DESK: Phase 6 v0.2 — edit thesis (partial update).
  router.patch(
    "/:companyId/deal-desk/theses/:thesisId",
    validate(updateThesisSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const thesisId = req.params.thesisId as string;
      assertCompanyAccess(req, companyId);

      const body = req.body as z.infer<typeof updateThesisSchema>;
      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          updateValues[key] = value;
        }
      }

      const [updated] = await db
        .update(ddTheses)
        .set(updateValues)
        .where(
          and(
            eq(ddTheses.paperclipCompanyId, companyId),
            eq(ddTheses.id, thesisId),
          ),
        )
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Thesis not found" });
        return;
      }
      res.json(updated);
    },
  );

  router.get(
    "/:companyId/deal-desk/theses/:thesisId/targets",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const thesisId = req.params.thesisId as string;
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(ddTargets)
        .where(
          and(
            eq(ddTargets.paperclipCompanyId, companyId),
            eq(ddTargets.thesisId, thesisId),
          ),
        )
        .orderBy(desc(ddTargets.fitScore));
      res.json(rows);
    },
  );

  // ── Targets ───────────────────────────────────────────────────────────────
  router.patch(
    "/:companyId/deal-desk/targets/:targetId/status",
    validate(updateTargetStatusSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const targetId = req.params.targetId as string;
      assertCompanyAccess(req, companyId);
      const { status } = req.body as z.infer<typeof updateTargetStatusSchema>;
      const [row] = await db
        .update(ddTargets)
        .set({
          status,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ddTargets.paperclipCompanyId, companyId),
            eq(ddTargets.id, targetId),
          ),
        )
        .returning();
      if (!row) {
        res.status(404).json({ error: "Target not found" });
        return;
      }
      res.json(row);
    },
  );

  // ── Intermediaries ────────────────────────────────────────────────────────
  router.get(
    "/:companyId/deal-desk/intermediaries",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(ddIntermediaries)
        .where(eq(ddIntermediaries.paperclipCompanyId, companyId))
        .orderBy(ddIntermediaries.nextTouchDue);
      res.json(rows);
    },
  );

  // ── Role templates (Phase 8) ──────────────────────────────────────────────
  // Returns the pre-built PE agent role templates seeded at server startup.
  // Consumed by the UI "Hire a Deal Desk Role" flow to pre-fill the new-agent
  // form (name, description, system prompt, recommended budget).
  router.get(
    "/:companyId/deal-desk/role-templates",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select({
          id: ddRoleTemplates.id,
          slug: ddRoleTemplates.slug,
          name: ddRoleTemplates.name,
          description: ddRoleTemplates.description,
          defaultHeartbeatCron: ddRoleTemplates.defaultHeartbeatCron,
          defaultBudgetUsd: ddRoleTemplates.defaultBudgetUsd,
          systemPrompt: ddRoleTemplates.systemPrompt,
        })
        .from(ddRoleTemplates)
        .orderBy(ddRoleTemplates.name);
      res.json(rows);
    },
  );

  // ── Tool endpoints ────────────────────────────────────────────────────────
  // Mount the Phase 5 tools router under /tools, scoped by companyId.
  // Tools enforce companyId in their handlers; the surrounding /api auth
  // middleware ensures the actor is authenticated.
  router.use(
    "/:companyId/deal-desk/tools",
    (req, _res, next) => {
      assertCompanyAccess(req, req.params.companyId as string);
      next();
    },
    dealDeskToolsRouter(db),
  );

  return router;
}

export { dealDeskRoutes as dealDeskRouter };
