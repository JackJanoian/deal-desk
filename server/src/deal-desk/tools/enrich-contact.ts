// DEAL DESK: Tool handler — find a contact at a target. Stub until API keys are wired.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";

export const enrichContactInputSchema = z.object({
  targetId: z.string().uuid(),
  titlesToSearch: z.array(z.string().min(1)).min(1),
});

export type EnrichContactInput = z.infer<typeof enrichContactInputSchema>;

export function enrichContactHandler(_db: Db) {
  return async (req: Request, res: Response) => {
    const parseResult = enrichContactInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid input",
        details: parseResult.error.flatten(),
      });
      return;
    }
    res.status(200).json({
      ok: false,
      reason:
        "Contact enrichment requires APOLLO_API_KEY or HUNTER_API_KEY. Configure one of these env vars to enable this tool.",
    });
  };
}

export function enrichContactRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.post("/", enrichContactHandler(db));
  return router;
}
