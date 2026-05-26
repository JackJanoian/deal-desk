// DEAL DESK: Tool handler — persist sourced acquisition targets
import { Router, type Request, type Response } from "express";
import type { Db } from "@dealdesk/db";
import {
  createTarget,
  createTargetInputSchema,
  type CreateTargetResult,
} from "../target-service.js";

export { createTargetInputSchema, type CreateTargetInput } from "../target-service.js";
export type { CreateTargetResult };

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

    const agentId = headerString(req, "x-deal-desk-agent-id");
    const issueId = headerString(req, "x-deal-desk-issue-id");

    try {
      const result = await createTarget(db, companyId, input, {
        agentId,
        issueId,
      });

      if (!result.ok) {
        res.status(200).json(result satisfies CreateTargetResult);
        return;
      }

      res.status(result.action === "created" ? 201 : 200).json(result);
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
