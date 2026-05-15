// DEAL DESK: Tool handler — list pending outreach sends awaiting partner approval
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddOutreachSends } from "@paperclipai/db";

export function listPendingOutreachHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const sends = await db.query.ddOutreachSends.findMany({
      where: and(
        eq(ddOutreachSends.paperclipCompanyId, companyId),
        eq(ddOutreachSends.status, "awaiting_approval"),
      ),
    });
    res.status(200).json({ sends });
  };
}
