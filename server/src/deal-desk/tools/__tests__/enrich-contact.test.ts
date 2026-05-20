import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichContactHandler } from "../enrich-contact.js";

const apolloMock = vi.fn();
vi.mock("../../enrichment/apollo-client.js", () => ({
  apolloMatchPerson: (...args: unknown[]) => apolloMock(...args),
}));

function makeApp(deps: Parameters<typeof enrichContactHandler>[0]) {
  const app = express();
  app.use(express.json());
  // Simulate the company-scoped route param
  app.post("/c/:companyId/enrich/:contactId", enrichContactHandler(deps));
  return app;
}

describe("enrich-contact handler", () => {
  let updateSet: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  // Shape returned by the join: id, firstName, lastName, domain (from dd_targets.website)
  let contactRow: { id: string; firstName: string | null; lastName: string | null; domain: string | null };

  beforeEach(() => {
    apolloMock.mockReset();
    contactRow = {
      id: "contact-1",
      firstName: "Alice",
      lastName: "Smith",
      domain: "acme.com",
    };
    updateSet = vi.fn().mockReturnThis();
    updateWhere = vi.fn().mockResolvedValue([{ id: "contact-1" }]);
  });

  // Mock the join select chain: db.select().from().innerJoin().where().limit()
  const db = (): any => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([contactRow]),
          }),
        }),
      }),
    }),
    update: () => ({ set: updateSet, where: updateWhere }),
  });

  it("returns 412 when no Apollo key configured", async () => {
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => null,
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(412);
    expect(res.body.reason).toMatch(/apollo/i);
  });

  it("calls Apollo and updates the contact when key is configured", async () => {
    apolloMock.mockResolvedValueOnce({ email: "alice@acme.com", emailStatus: "verified" });
    updateSet.mockImplementationOnce((patch: Record<string, unknown>) => {
      expect(patch.email).toBe("alice@acme.com");
      expect(patch.emailStatus).toBe("verified");
      expect(patch.source).toBe("apollo");
      expect(patch.enrichedAt).toBeInstanceOf(Date);
      return { where: updateWhere };
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, email: "alice@acme.com", emailStatus: "verified" });
  });

  it("returns 404 when contact missing", async () => {
    const emptyDb = (): any => ({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
      update: () => ({ set: updateSet, where: updateWhere }),
    });
    const app = makeApp({
      db: emptyDb(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/missing").send({});
    expect(res.status).toBe(404);
  });

  it("returns ok:false when Apollo finds no email", async () => {
    apolloMock.mockResolvedValueOnce({ email: null, emailStatus: null });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, reason: "no email found" });
  });

  it("returns 422 when contact missing firstName", async () => {
    contactRow = { id: "contact-1", firstName: null, lastName: "Smith", domain: "acme.com" };
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(422);
  });
});
