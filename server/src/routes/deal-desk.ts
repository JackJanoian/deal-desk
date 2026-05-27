// DEAL DESK: PE-specific API routes. Mounted at /api/companies and scoped by
// :companyId. Auth comes from the global actorMiddleware applied to /api in
// app.ts; per-route authorization uses assertCompanyAccess to mirror
// server/src/routes/companies.ts.

import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import {
  ddTheses,
  ddTargets,
  ddIntermediaries,
  ddRoleTemplates,
} from "@dealdesk/db";

import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { dealDeskToolsRouter } from "../deal-desk/tools/index.js";
import {
  createTarget,
  createTargetInputSchema,
  getTarget,
  getPipelineSummary,
  targetStatusValues,
  updateTarget,
  updateTargetInputSchema,
} from "../deal-desk/target-service.js";

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

// DEAL DESK: M3 — Explicit whitelist of columns that PATCH thesis is allowed
// to update. Keep in sync with `updateThesisSchema` above. This prevents a
// future schema addition (e.g. `dealDeskCompanyId`, `createdByUserId`) from
// silently becoming tenant-overridable via the request body.
const ALLOWED_THESIS_UPDATE_KEYS = [
  "name",
  "sector",
  "subSectors",
  "geos",
  "revenueMin",
  "revenueMax",
  "ebitdaMin",
  "ebitdaMax",
  "dealSizeMin",
  "dealSizeMax",
  "ownershipPreferences",
  "exclusionCriteria",
  "narrative",
  "templateSlug",
  "status",
  "attachments",
] as const;

export function buildThesisUpdateValues(
  body: Partial<z.infer<typeof updateThesisSchema>>,
): Record<string, unknown> {
  const updateValues: Record<string, unknown> = {};
  for (const key of ALLOWED_THESIS_UPDATE_KEYS) {
    const value = (body as Record<string, unknown>)[key];
    if (value !== undefined) {
      updateValues[key] = value;
    }
  }
  return updateValues;
}

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
          dealDeskCompanyId: companyId,
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
      .where(eq(ddTheses.dealDeskCompanyId, companyId))
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
            eq(ddTheses.dealDeskCompanyId, companyId),
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
      const updateValues: Record<string, unknown> = {
        ...buildThesisUpdateValues(body),
        updatedAt: new Date(),
      };

      const [updated] = await db
        .update(ddTheses)
        .set(updateValues)
        .where(
          and(
            eq(ddTheses.dealDeskCompanyId, companyId),
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
            eq(ddTargets.dealDeskCompanyId, companyId),
            eq(ddTargets.thesisId, thesisId),
          ),
        )
        .orderBy(desc(ddTargets.fitScore));
      res.json(rows);
    },
  );

  // ── Targets ───────────────────────────────────────────────────────────────
  router.post(
    "/:companyId/deal-desk/targets",
    validate(createTargetInputSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const body = req.body as z.infer<typeof createTargetInputSchema>;
      const result = await createTarget(db, companyId, body);
      if (!result.ok) {
        res.status(422).json({ error: result.reason });
        return;
      }
      const target = await getTarget(db, companyId, result.targetId);
      res.status(result.action === "created" ? 201 : 200).json(target);
    },
  );

  router.get(
    "/:companyId/deal-desk/targets/:targetId",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const targetId = req.params.targetId as string;
      assertCompanyAccess(req, companyId);
      const target = await getTarget(db, companyId, targetId);
      if (!target) {
        res.status(404).json({ error: "Target not found" });
        return;
      }
      res.json(target);
    },
  );

  router.patch(
    "/:companyId/deal-desk/targets/:targetId",
    validate(updateTargetInputSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const targetId = req.params.targetId as string;
      assertCompanyAccess(req, companyId);
      const body = req.body as z.infer<typeof updateTargetInputSchema>;
      const result = await updateTarget(db, companyId, targetId, body);
      if (!result.ok) {
        res.status(result.status ?? 400).json({ error: result.reason });
        return;
      }
      res.json(result.target);
    },
  );

  router.patch(
    "/:companyId/deal-desk/targets/:targetId/status",
    validate(updateTargetStatusSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const targetId = req.params.targetId as string;
      assertCompanyAccess(req, companyId);
      const { status } = req.body as z.infer<typeof updateTargetStatusSchema>;
      const result = await updateTarget(db, companyId, targetId, { status });
      if (!result.ok) {
        res.status(result.status ?? 400).json({ error: result.reason });
        return;
      }
      res.json(result.target);
    },
  );

  router.get(
    "/:companyId/deal-desk/pipeline/summary",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const thesisId = req.query.thesisId;
      if (typeof thesisId !== "string" || thesisId.length === 0) {
        res.status(400).json({ error: "thesisId query parameter is required" });
        return;
      }
      const summary = await getPipelineSummary(db, companyId, thesisId);
      res.json(summary);
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
        .where(eq(ddIntermediaries.dealDeskCompanyId, companyId))
        .orderBy(ddIntermediaries.nextTouchDue);
      res.json(rows);
    },
  );

  // ── Role templates (Phase 8) ──────────────────────────────────────────────
  // Returns the pre-built PE agent role templates seeded at server startup.
  // Consumed by the UI "Hire a DealDesk Role" flow to pre-fill the new-agent
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
