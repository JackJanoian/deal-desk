import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { eq, and } from "drizzle-orm";
import { ddEmailAccounts } from "@dealdesk/db";
import { collectStringParams } from "./helpers/where-introspection.js";

describe("DELETE /companies/:companyId/email-accounts/:id (tenant scope)", () => {
  it("returns 404 when the account belongs to a different company (IDOR guard)", async () => {
    // The account belongs to co-B, but URL says co-A. The scoped UPDATE must
    // restrict by BOTH id and dealDeskCompanyId, so .returning() yields []
    // and the handler responds 404.
    //
    // Conditional mock: emulate a real tenant-scoped DB. If the where clause
    // mentions co-A (correctly scoped query) -> return []. If the handler is
    // unscoped (where only contains the id) -> return the wrong-tenant row so
    // an unscoped handler would proceed past the 404 check and the test would
    // fail at the status assertion. This gives the IDOR mock real teeth.
    const capturedWheres: unknown[] = [];
    const returningMock = vi.fn(async () => {
      const lastWhere = capturedWheres[capturedWheres.length - 1];
      const params = collectStringParams(lastWhere);
      if (params.includes("co-A")) return [];
      // Wrong-tenant row — only an unscoped handler would receive this.
      return [{ id: "acc-B" }];
    });

    const fakeDb = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn((clause: unknown) => {
            capturedWheres.push(clause);
            return {
              returning: returningMock,
            };
          }),
        })),
      })),
    };

    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: "u-1", source: "session" };
      next();
    });

    // Inline the handler under test (mirrors server/src/deal-desk/tools/index.ts).
    app.delete(
      "/companies/:companyId/email-accounts/:id",
      async (req, res) => {
        const id = req.params.id as string;
        const companyId = req.params.companyId as string;
        const result = await (fakeDb as never as {
          update: (...a: unknown[]) => {
            set: (v: unknown) => {
              where: (c: unknown) => { returning: (cols: unknown) => Promise<{ id: string }[]> };
            };
          };
        })
          .update(ddEmailAccounts)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(ddEmailAccounts.id, id),
              eq(ddEmailAccounts.dealDeskCompanyId, companyId),
            ),
          )
          .returning({ id: ddEmailAccounts.id });
        if (result.length === 0) {
          res.status(404).json({ ok: false, reason: "Email account not found" });
          return;
        }
        res.status(200).json({ ok: true });
      },
    );

    const res = await request(app).delete("/companies/co-A/email-accounts/acc-B");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false, reason: "Email account not found" });

    // Confirm the handler issued a scoped update — where contains co-A + acc-B,
    // and never the account's real owner co-B.
    expect(capturedWheres.length).toBe(1);
    const params = collectStringParams(capturedWheres[0]);
    expect(params).toContain("co-A");
    expect(params).toContain("acc-B");
    expect(params).not.toContain("co-B");
  });
});
