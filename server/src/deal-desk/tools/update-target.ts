// DEAL DESK: Tool handler — update an existing target (status and fields)
import { Router, type Request, type Response } from "express";
import type { Db } from "@dealdesk/db";
import {
  updateTarget,
  updateTargetInputSchema,
} from "../target-service.js";

export { updateTargetInputSchema, type UpdateTargetInput } from "../target-service.js";

export function updateTargetHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string | undefined;
    const targetId = req.params.targetId as string | undefined;
    if (!companyId || !targetId) {
      res.status(400).json({ ok: false, reason: "Missing companyId or targetId" });
      return;
    }

    const parseResult = updateTargetInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid input",
        details: parseResult.error.flatten(),
      });
      return;
    }

    try {
      const result = await updateTarget(db, companyId, targetId, parseResult.data);
      if (!result.ok) {
        res.status(result.status ?? 400).json({ ok: false, reason: result.reason });
        return;
      }
      res.status(200).json({ ok: true, target: result.target });
    } catch (error) {
      res.status(500).json({
        ok: false,
        reason: `Database error: ${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  };
}

export function updateTargetRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.patch("/:targetId", updateTargetHandler(db));
  return router;
}
