// DEAL DESK: Tool handler — get a single target by id
import { Router, type Request, type Response } from "express";
import type { Db } from "@dealdesk/db";
import { getTarget } from "../target-service.js";

export function getTargetHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string | undefined;
    const targetId = req.params.targetId as string | undefined;
    if (!companyId || !targetId) {
      res.status(400).json({ ok: false, reason: "Missing companyId or targetId" });
      return;
    }

    try {
      const target = await getTarget(db, companyId, targetId);
      if (!target) {
        res.status(404).json({ ok: false, reason: "Target not found" });
        return;
      }
      res.status(200).json({ ok: true, target });
    } catch (error) {
      res.status(500).json({
        ok: false,
        reason: `Database error: ${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  };
}

export function getTargetRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.get("/:targetId", getTargetHandler(db));
  return router;
}
