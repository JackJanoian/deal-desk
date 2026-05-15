// DEAL DESK: Tool handler factories and registration helper.
//
// These are exposed as HTTP endpoints because Paperclip's tool model is
// per-adapter (no generic tool registry).
//
// Phase 5 only builds the handlers + a registration helper. Phase 6 will
// mount the company-scoped router in server/src/app.ts under
// /api/companies/:companyId/deal-desk/...

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddEmailAccounts } from "@paperclipai/db";
import type { GoogleOAuthConfig } from "../../config.js";

import { createTargetHandler } from "./create-target.js";
import { listTargetsHandler } from "./list-targets.js";
import { createIntermediaryHandler } from "./create-intermediary.js";
import { listIntermediariesHandler } from "./list-intermediaries.js";
import { recordIntermediaryTouchHandler } from "./record-intermediary-touch.js";
import { enrichContactHandler } from "./enrich-contact.js";
import { outreachDraftHandler } from "./outreach-draft.js";
import { outreachApproveHandler, outreachRejectHandler } from "./outreach-approve.js";
import { listPendingOutreachHandler } from "./outreach-list-pending.js";

export {
  createTargetHandler,
  createTargetInputSchema,
  type CreateTargetInput,
  type CreateTargetResult,
} from "./create-target.js";
export {
  listTargetsHandler,
  listTargetsQuerySchema,
  type ListTargetsQuery,
} from "./list-targets.js";
export {
  createIntermediaryHandler,
  createIntermediaryInputSchema,
  type CreateIntermediaryInput,
  type CreateIntermediaryResult,
} from "./create-intermediary.js";
export {
  listIntermediariesHandler,
  listIntermediariesQuerySchema,
  type ListIntermediariesQuery,
} from "./list-intermediaries.js";
export {
  recordIntermediaryTouchHandler,
  recordIntermediaryTouchInputSchema,
  type RecordIntermediaryTouchInput,
} from "./record-intermediary-touch.js";
export {
  enrichContactHandler,
  enrichContactInputSchema,
  type EnrichContactInput,
} from "./enrich-contact.js";
export {
  outreachDraftHandler,
  outreachDraftInputSchema,
  type OutreachDraftInput,
} from "./outreach-draft.js";
export { outreachApproveHandler, outreachRejectHandler } from "./outreach-approve.js";

/**
 * Mount all Deal Desk tool endpoints onto a parent router.
 *
 * The parent router is expected to be scoped to a Paperclip company — that is,
 * `req.params.companyId` must be available on each request. Phase 6 will
 * mount this router under `/api/companies/:companyId/deal-desk/tools`.
 *
 * Sub-paths exposed (all relative to the parent):
 *   POST /targets                      — create a sourced target
 *   GET  /targets                      — list targets for a thesis
 *   POST /intermediaries               — create an intermediary
 *   GET  /intermediaries               — list intermediaries (overdue-first)
 *   POST /intermediaries/touch         — record a touch with an intermediary
 *   POST /contacts/enrich              — enrich a contact (stub w/o API keys)
 *   POST /outreach/sends/:id/approve   — approve and dispatch a queued send
 *   POST /outreach/sends/:id/reject    — reject a queued send
 */
export function registerDealDeskTools(
  parent: Router,
  db: Db,
  opts: { googleOAuth?: GoogleOAuthConfig | null } = {},
): Router {
  parent.post("/targets", createTargetHandler(db));
  parent.get("/targets", listTargetsHandler(db));
  parent.post("/intermediaries", createIntermediaryHandler(db));
  parent.get("/intermediaries", listIntermediariesHandler(db));
  parent.post("/intermediaries/touch", recordIntermediaryTouchHandler(db));
  parent.post("/contacts/enrich", enrichContactHandler(db));
  parent.post("/outreach/draft", outreachDraftHandler(db));
  parent.post(
    "/outreach/sends/:id/approve",
    outreachApproveHandler({ db, googleOAuth: opts.googleOAuth ?? null }),
  );
  parent.post("/outreach/sends/:id/reject", outreachRejectHandler({ db }));

  parent.get("/outreach/sends/pending", listPendingOutreachHandler(db));

  parent.get("/email-accounts", async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const rows = await db.query.ddEmailAccounts.findMany({
      where: eq(ddEmailAccounts.paperclipCompanyId, companyId),
    });
    res.status(200).json({ accounts: rows });
  });

  parent.delete("/email-accounts/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await db
      .update(ddEmailAccounts)
      .set({ revokedAt: new Date() })
      .where(eq(ddEmailAccounts.id, id));
    res.status(200).json({ ok: true });
  });

  return parent;
}

/**
 * Build a self-contained Deal Desk tools router. Convenience wrapper for
 * callers that want a single router to mount (Phase 6 may use this directly).
 */
export function dealDeskToolsRouter(
  db: Db,
  opts: { googleOAuth?: GoogleOAuthConfig | null } = {},
): Router {
  const router = Router({ mergeParams: true });
  return registerDealDeskTools(router, db, opts);
}
