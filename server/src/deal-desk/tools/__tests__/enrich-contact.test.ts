import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { enrichContactHandler } from "../enrich-contact.js";
import { collectStringParams } from "./helpers/where-introspection.js";

const resolveContactEmailMock = vi.fn();

vi.mock("../../enrichment/resolve-contact-email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../enrichment/resolve-contact-email.js")>();
  return {
    ...actual,
    resolveContactEmail: (...args: unknown[]) => resolveContactEmailMock(...args),
  };
});

function makeApp(deps: Parameters<typeof enrichContactHandler>[0]) {
  const app = express();
  app.use(express.json());
  app.post("/c/:companyId/enrich/:contactId", enrichContactHandler(deps));
  return app;
}

describe("enrich-contact handler", () => {
  let updateSet: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  let updateReturning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolveContactEmailMock.mockReset();
    updateReturning = vi.fn().mockResolvedValue([{ id: "contact-1" }]);
    updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  });

  const db = (): any => ({
    update: () => ({ set: updateSet }),
  });

  it("returns 412 when no Apollo key configured", async () => {
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: false,
      code: "apollo_not_configured",
      reason: "Apollo.io API key not configured",
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => null,
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(412);
    expect(res.body.code).toBe("apollo_not_configured");
  });

  it("calls resolveContactEmail and updates the contact when enrichment succeeds", async () => {
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: true,
      email: "alice@acme.com",
      emailStatus: "verified",
      source: "apollo",
      contactId: "contact-1",
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
    });
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
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: false,
      code: "contact_not_found",
      reason: "contact not found",
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/missing").send({});
    expect(res.status).toBe(404);
  });

  it("returns ok:false when Apollo finds no email", async () => {
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: false,
      code: "no_email_found",
      reason: "No email found",
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, reason: "No email found", code: "no_email_found" });
  });

  it("returns 422 when contact missing required fields", async () => {
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: false,
      code: "missing_contact_fields",
      reason: "contact missing firstName, lastName, or company domain",
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(422);
  });

  it("returns 422 when Apollo plan is blocked", async () => {
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: false,
      code: "apollo_plan_blocked",
      reason: "Apollo cannot reveal emails on this plan",
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/c1/enrich/contact-1").send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("apollo_plan_blocked");
  });

  it("returns 404 (IDOR guard) when UPDATE matches zero rows for the URL companyId", async () => {
    // Simulate worst case: resolveContactEmail returned ok (e.g. helper bypassed),
    // but the tenant-scoped UPDATE finds no row for the URL companyId "co-A".
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: true,
      email: "victim@target.com",
      emailStatus: "verified",
      source: "apollo",
      contactId: "contact-foreign",
      firstName: "V",
      lastName: "Ictim",
      companyDomain: "target.com",
    });
    // The UPDATE's where clause should contain the URL companyId "co-A".
    // When it does, return [] to mimic "no row matched" (i.e. contact belongs to another tenant).
    updateWhere.mockImplementationOnce((whereNode: unknown) => {
      const params = collectStringParams(whereNode);
      if (params.includes("co-A")) {
        return { returning: vi.fn().mockResolvedValue([]) };
      }
      return { returning: vi.fn().mockResolvedValue([{ id: "contact-foreign" }]) };
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/co-A/enrich/contact-foreign").send({});
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("contact_not_found");
  });

  it("UPDATE where clause includes URL companyId for tenant scoping", async () => {
    resolveContactEmailMock.mockResolvedValueOnce({
      ok: true,
      email: "alice@acme.com",
      emailStatus: "verified",
      source: "apollo",
      contactId: "contact-1",
      firstName: "Alice",
      lastName: "Smith",
      companyDomain: "acme.com",
    });
    let capturedParams: string[] = [];
    updateWhere.mockImplementationOnce((whereNode: unknown) => {
      capturedParams = collectStringParams(whereNode);
      return { returning: vi.fn().mockResolvedValue([{ id: "contact-1" }]) };
    });
    const app = makeApp({
      db: db(),
      loadApolloKey: async () => "key-xyz",
    });
    const res = await request(app).post("/c/co-tenant-1/enrich/contact-1").send({});
    expect(res.status).toBe(200);
    expect(capturedParams).toContain("co-tenant-1");
    expect(capturedParams).toContain("contact-1");
  });
});
