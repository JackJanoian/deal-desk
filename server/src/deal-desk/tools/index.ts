// DEAL DESK: Tool handler factories and registration helper.
//
// These are exposed as HTTP endpoints because Paperclip's tool model is
// per-adapter (no generic tool registry). Skills in skills/deal-desk/*.md
// document the endpoints agents call.
//
// Phase 5 only builds the handlers + a registration helper. Phase 6 will
// mount the company-scoped router in server/src/app.ts under
// /api/companies/:companyId/deal-desk/...

import { Router } from "express";
import type { Db } from "@paperclipai/db";

import { createTargetHandler } from "./create-target.js";
import { listTargetsHandler } from "./list-targets.js";
import { createIntermediaryHandler } from "./create-intermediary.js";
import { listIntermediariesHandler } from "./list-intermediaries.js";
import { recordIntermediaryTouchHandler } from "./record-intermediary-touch.js";
import { generateMemoHandler } from "./generate-memo.js";
import { enrichContactHandler } from "./enrich-contact.js";

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
  generateMemoHandler,
  generateMemoInputSchema,
  type GenerateMemoInput,
} from "./generate-memo.js";
export {
  enrichContactHandler,
  enrichContactInputSchema,
  type EnrichContactInput,
} from "./enrich-contact.js";

/**
 * Mount all Deal Desk tool endpoints onto a parent router.
 *
 * The parent router is expected to be scoped to a Paperclip company — that is,
 * `req.params.companyId` must be available on each request. Phase 6 will
 * mount this router under `/api/companies/:companyId/deal-desk/tools`.
 *
 * Sub-paths exposed (all relative to the parent):
 *   POST /targets                — create a sourced target
 *   GET  /targets                — list targets for a thesis
 *   POST /intermediaries         — create an intermediary
 *   GET  /intermediaries         — list intermediaries (overdue-first)
 *   POST /intermediaries/touch   — record a touch with an intermediary
 *   POST /memos                  — upsert a weekly pipeline memo
 *   POST /contacts/enrich        — enrich a contact (stub w/o API keys)
 */
export function registerDealDeskTools(parent: Router, db: Db): Router {
  parent.post("/targets", createTargetHandler(db));
  parent.get("/targets", listTargetsHandler(db));
  parent.post("/intermediaries", createIntermediaryHandler(db));
  parent.get("/intermediaries", listIntermediariesHandler(db));
  parent.post("/intermediaries/touch", recordIntermediaryTouchHandler(db));
  parent.post("/memos", generateMemoHandler(db));
  parent.post("/contacts/enrich", enrichContactHandler(db));
  return parent;
}

/**
 * Build a self-contained Deal Desk tools router. Convenience wrapper for
 * callers that want a single router to mount (Phase 6 may use this directly).
 */
export function dealDeskToolsRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  return registerDealDeskTools(router, db);
}
