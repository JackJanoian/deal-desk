import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { outreachEditHandler } from "../outreach-edit.js";
import { collectStringParams } from "./helpers/where-introspection.js";

function makeApp(deps: Parameters<typeof outreachEditHandler>[0]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "11111111-1111-4111-8111-111111111111",
      source: "session",
    };
    next();
  });
  app.patch("/sends/:id", outreachEditHandler(deps));
  return app;
}

describe("PATCH /outreach/sends/:id", () => {
  let updateSet: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  let selectLimit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    selectLimit = vi.fn().mockResolvedValue([
      { id: "send-1", status: "awaiting_approval", contactId: "contact-1" },
    ]);
    updateSet = vi.fn().mockReturnThis();
    updateWhere = vi.fn().mockResolvedValue([{ id: "send-1" }]);
  });

  const db = (): any => ({
    select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
    update: () => ({ set: updateSet, where: updateWhere }),
  });

  it("rejects when status is not awaiting_approval", async () => {
    selectLimit = vi.fn().mockResolvedValue([{ id: "send-1", status: "sent" }]);
    const app = makeApp({ db: db() });
    const res = await request(app)
      .patch("/sends/send-1")
      .send({ subject: "Hi" });
    expect(res.status).toBe(409);
    expect(res.body.reason).toMatch(/awaiting_approval/);
  });

  it("returns 404 when send not found", async () => {
    selectLimit = vi.fn().mockResolvedValue([]);
    const app = makeApp({ db: db() });
    const res = await request(app).patch("/sends/missing").send({ subject: "Hi" });
    expect(res.status).toBe(404);
  });

  it("updates subject + body and writes audit fields", async () => {
    updateSet = vi.fn().mockImplementation((patch) => {
      expect(patch.subject).toBe("New subject");
      expect(patch.body).toBe("New body");
      expect(patch.editedByUserId).toBe("11111111-1111-4111-8111-111111111111");
      expect(patch.editedAt).toBeInstanceOf(Date);
      return { where: updateWhere };
    });
    const app = makeApp({ db: db() });
    const res = await request(app)
      .patch("/sends/send-1")
      .send({ subject: "New subject", body: "New body" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects empty body when all fields missing", async () => {
    const app = makeApp({ db: db() });
    const res = await request(app).patch("/sends/send-1").send({});
    expect(res.status).toBe(400);
  });

  it("updates recipient email on linked contact", async () => {
    const sets: unknown[] = [];
    updateSet = vi.fn().mockImplementation((patch) => {
      sets.push(patch);
      return { where: updateWhere };
    });
    const app = makeApp({ db: db() });
    const res = await request(app)
      .patch("/sends/send-1")
      .send({ recipientEmail: "bob@example.com" });
    expect(res.status).toBe(200);
    expect(
      sets.some((patch) => (patch as { email?: string }).email === "bob@example.com"),
    ).toBe(true);
  });

  it("returns 404 when sendId belongs to a different company (IDOR guard)", async () => {
    // Conditional mock emulating a tenant-scoped DB:
    // - If the where clause mentions co-A (correct scoped query) -> no row -> [].
    // - Otherwise (unscoped) -> return the seeded send so an unscoped handler would
    //   advance past the 404 and the test would fail.
    const SEND = {
      id: "send-B",
      status: "awaiting_approval" as const,
      contactId: "c-1",
      intermediaryId: null,
      dealDeskCompanyId: "co-B",
    };
    const selectLimitFn = vi.fn(async () => [SEND]);
    let lastSelectWhere: unknown = undefined;
    let lastUpdateWhere: unknown = undefined;
    const updateWhereFn = vi.fn(async (clause: unknown) => {
      lastUpdateWhere = clause;
      return [];
    });

    const db: any = {
      select: () => ({
        from: () => ({
          where: (clause: unknown) => {
            lastSelectWhere = clause;
            const params = collectStringParams(clause);
            // Override the default mock based on where-shape
            if (params.includes("co-A")) {
              return { limit: vi.fn(async () => []) };
            }
            return { limit: selectLimitFn };
          },
        }),
      }),
      update: () => ({
        set: () => ({ where: updateWhereFn }),
      }),
    };

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "board",
        userId: "11111111-1111-4111-8111-111111111111",
        source: "session",
      };
      next();
    });
    app.patch(
      "/companies/:companyId/outreach/sends/:id",
      outreachEditHandler({ db }),
    );

    const res = await request(app)
      .patch("/companies/co-A/outreach/sends/send-B")
      .send({ subject: "Hi" });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false });
    expect(updateWhereFn).not.toHaveBeenCalled();

    // Confirm the handler issued a scoped lookup (where contains co-A + send-B,
    // never the send's real owner co-B).
    const selectParams = collectStringParams(lastSelectWhere);
    expect(selectParams).toContain("co-A");
    expect(selectParams).toContain("send-B");
    expect(selectParams).not.toContain("co-B");
    expect(lastUpdateWhere).toBeUndefined();
  });

  it("allows local_trusted board edits without a uuid user id", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "board",
        userId: "local-board",
        source: "local_implicit",
      };
      next();
    });
    app.patch("/sends/:id", outreachEditHandler({ db: db() }));
    updateSet = vi.fn().mockImplementation((patch) => {
      expect(patch.editedByUserId).toBeNull();
      expect(patch.editedAt).toBeInstanceOf(Date);
      return { where: updateWhere };
    });
    const res = await request(app)
      .patch("/sends/send-1")
      .send({ subject: "Local edit" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
