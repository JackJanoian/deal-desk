// DEAL DESK: Tool handler — upsert weekly pipeline memo
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ddMemos } from "@paperclipai/db";

export const generateMemoInputSchema = z.object({
  markdown: z.string().min(1),
  weekStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "weekStartDate must be ISO date YYYY-MM-DD"),
});

export type GenerateMemoInput = z.infer<typeof generateMemoInputSchema>;

function headerString(req: Request, name: string): string | undefined {
  const raw = req.header(name);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function generateMemoHandler(db: Db) {
  return async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string | undefined;
    if (!companyId) {
      res.status(400).json({ ok: false, reason: "Missing companyId in path" });
      return;
    }
    const parseResult = generateMemoInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        reason: "Invalid input",
        details: parseResult.error.flatten(),
      });
      return;
    }
    const input = parseResult.data;
    const agentId = headerString(req, "x-deal-desk-agent-id");

    try {
      const existing = await db.query.ddMemos.findFirst({
        where: and(
          eq(ddMemos.paperclipCompanyId, companyId),
          eq(ddMemos.weekStartDate, input.weekStartDate),
        ),
      });

      if (existing) {
        await db
          .update(ddMemos)
          .set({
            markdown: input.markdown,
            generatedByAgentId: agentId ?? existing.generatedByAgentId,
          })
          .where(eq(ddMemos.id, existing.id));
        res.json({ ok: true, memoId: existing.id, action: "updated" });
        return;
      }

      const inserted = await db
        .insert(ddMemos)
        .values({
          paperclipCompanyId: companyId,
          generatedByAgentId: agentId,
          weekStartDate: input.weekStartDate,
          markdown: input.markdown,
        })
        .returning({ id: ddMemos.id });

      const row = inserted[0];
      if (!row) {
        res.status(500).json({ ok: false, reason: "Insert returned no rows" });
        return;
      }
      res.status(201).json({ ok: true, memoId: row.id, action: "created" });
    } catch (error) {
      res.status(500).json({
        ok: false,
        reason: `Database error: ${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  };
}

export function generateMemoRouter(db: Db): Router {
  const router = Router({ mergeParams: true });
  router.post("/", generateMemoHandler(db));
  return router;
}
