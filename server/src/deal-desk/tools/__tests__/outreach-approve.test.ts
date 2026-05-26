import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { outreachApproveHandler, outreachRejectHandler } from "../outreach-approve.js";
import { collectStringParams } from "./helpers/where-introspection.js";

const loadContactForEnrichmentMock = vi.fn();
const ensureContactEmailFromApolloMock = vi.fn();

vi.mock("../../enrichment/resolve-contact-email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../enrichment/resolve-contact-email.js")>();
  return {
    ...actual,
    loadContactForEnrichment: (...args: unknown[]) => loadContactForEnrichmentMock(...args),
    ensureContactEmailFromApollo: (...args: unknown[]) =>
      ensureContactEmailFromApolloMock(...args),
    contactNeedsApolloEnrichment: actual.contactNeedsApolloEnrichment,
  };
});

describe("POST /outreach/sends/:id/approve", () => {
  it("loads the send, auto-enriches, sends, updates row", async () => {
    loadContactForEnrichmentMock.mockResolvedValueOnce({
      id: "c-1",
      email: "test@example.com",
      source: "manual",
      emailStatus: "unverified",
    });
    ensureContactEmailFromApolloMock.mockResolvedValueOnce({
      ok: true,
      email: "bob@example.com",
      emailStatus: "verified",
      enriched: true,
    });
    const fakeDb = {
      query: {
        ddOutreachSends: {
          findFirst: vi.fn().mockResolvedValue({
            id: "send-1",
            dealDeskCompanyId: "co-1",
            subject: "Hello",
            body: "Hi",
            contactId: "c-1",
            status: "awaiting_approval",
          }),
        },
        ddContacts: {
          findFirst: vi.fn().mockResolvedValue({
            id: "c-1",
            email: "bob@example.com",
          }),
        },
        ddEmailAccounts: {
          findFirst: vi.fn().mockResolvedValue({
            id: "acc-1",
            emailAddress: "alice@example.com",
            secretId: "sec-1",
          }),
        },
      },
      update: () => ({ set: (v: unknown) => ({ where: async () => v }) }),
    };
    const fakeSendGmail = vi.fn().mockResolvedValue({ messageId: "g-1", threadId: "t-1" });
    const fakeLoadTokens = vi.fn().mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Date.now() + 600_000,
      scope: "x",
    });
    const fakeEnsureFresh = vi.fn().mockImplementation(async (i) => i.tokens);

    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "board",
        userId: "11111111-1111-4111-8111-111111111111",
        source: "session",
      };
      next();
    });
    app.post("/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      loadClientConfig: async () => ({ clientId: "c", clientSecret: "s" }),
      loadApolloKey: async () => "apollo-key",
      sendGmail: fakeSendGmail,
      loadGmailTokens: fakeLoadTokens,
      ensureFreshAccessToken: fakeEnsureFresh,
    }));
    const res = await request(app).post("/outreach/sends/send-1/approve");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ messageId: "g-1", recipientEmail: "bob@example.com" });
    expect(fakeSendGmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Hello",
        body: "Hi",
      }),
      expect.anything(),
    );
  });

  it("returns 422 when Apollo plan is blocked", async () => {
    loadContactForEnrichmentMock.mockResolvedValueOnce({
      id: "c-1",
      email: null,
      source: null,
      emailStatus: "unverified",
    });
    ensureContactEmailFromApolloMock.mockResolvedValueOnce({
      ok: false,
      code: "apollo_plan_blocked",
      reason: "Apollo cannot reveal emails on this plan",
    });
    const fakeDb = {
      query: {
        ddOutreachSends: {
          findFirst: vi.fn().mockResolvedValue({
            id: "send-1",
            dealDeskCompanyId: "co-1",
            subject: "Hello",
            body: "Hi",
            contactId: "c-1",
            status: "awaiting_approval",
          }),
        },
      },
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: "u-1", source: "session" };
      next();
    });
    app.post("/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      loadClientConfig: async () => ({ clientId: "c", clientSecret: "s" }),
      loadApolloKey: async () => "apollo-key",
    }));
    const res = await request(app).post("/outreach/sends/send-1/approve");
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("apollo_plan_blocked");
  });

  it("returns 412 when company has no OAuth client configured", async () => {
    const fakeDb = {
      query: {
        ddOutreachSends: {
          findFirst: vi.fn().mockResolvedValue({
            id: "s-1",
            dealDeskCompanyId: "co-1",
            subject: "X",
            body: "Y",
            contactId: "c-1",
            status: "awaiting_approval",
          }),
        },
      },
    };
    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: "u-1", source: "session" };
      next();
    });
    app.post("/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      loadClientConfig: async () => null,
    }));
    const res = await request(app).post("/outreach/sends/s-1/approve");
    expect(res.status).toBe(412);
  });

  it("returns 403 when actor is an agent (only board may approve)", async () => {
    const findFirst = vi.fn();
    const fakeDb = {
      query: {
        ddOutreachSends: { findFirst },
      },
    };
    const fakeSendGmail = vi.fn();
    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = { type: "agent", agentId: "a1", companyId: "co-A" };
      (req as any).params = { ...(req as any).params, companyId: "co-A" };
      next();
    });
    app.post("/companies/:companyId/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      loadClientConfig: async () => ({ clientId: "c", clientSecret: "s" }),
      sendGmail: fakeSendGmail,
    }));
    const res = await request(app)
      .post("/companies/co-A/outreach/sends/send-1/approve");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ ok: false });
    expect(findFirst).not.toHaveBeenCalled();
    expect(fakeSendGmail).not.toHaveBeenCalled();
  });

  it("returns 404 when sendId belongs to a different company (IDOR guard)", async () => {
    // Simulate scoped DB: findFirst only returns the send when the where clause
    // restricts by BOTH id and dealDeskCompanyId. The send belongs to co-B but
    // the URL is /companies/co-A/.../sends/send-B/approve — so the scoped query
    // returns undefined and the handler responds 404.
    const SEND = {
      id: "send-B",
      dealDeskCompanyId: "co-B",
      subject: "Hello",
      body: "Hi",
      contactId: "c-1",
      status: "awaiting_approval" as const,
    };
    // Conditional mock: emulate a real tenant-scoped DB.
    // - If the where clause mentions co-A (correct scoped query) -> no such row -> undefined.
    // - If the where clause does NOT mention co-A (handler is unscoped) -> return the
    //   seeded SEND row so an unscoped handler would proceed past the 404 and the test
    //   would fail at the status assertion. This gives the IDOR mock real teeth.
    const findFirst = vi.fn(async (args: { where: unknown }) => {
      const params = collectStringParams(args.where);
      if (params.includes("co-A")) return undefined;
      return SEND;
    });
    const fakeDb = {
      query: {
        ddOutreachSends: { findFirst },
      },
    };
    const fakeSendGmail = vi.fn();
    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: "u-1", source: "session" };
      // Inject URL companyId param the way the real router does.
      (req as any).params = { ...(req as any).params, companyId: "co-A" };
      next();
    });
    app.post("/companies/:companyId/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      loadClientConfig: async () => ({ clientId: "c", clientSecret: "s" }),
      sendGmail: fakeSendGmail,
    }));
    app.post("/companies/:companyId/outreach/sends/:id/reject", outreachRejectHandler({
      db: fakeDb as never,
    }));

    const approveRes = await request(app)
      .post("/companies/co-A/outreach/sends/send-B/approve");
    expect(approveRes.status).toBe(404);
    expect(approveRes.body).toMatchObject({ ok: false });
    expect(fakeSendGmail).not.toHaveBeenCalled();

    const rejectRes = await request(app)
      .post("/companies/co-A/outreach/sends/send-B/reject");
    expect(rejectRes.status).toBe(404);
    expect(rejectRes.body).toMatchObject({ ok: false });

    // Assert the handler actually requested a scoped lookup — the where clause
    // is the result of and(eq(id), eq(dealDeskCompanyId)). Pre-fix the where
    // was just eq(id), so the captured call would not contain "co-A" anywhere
    // in its param values. We walk the drizzle SQL object and collect string
    // params, avoiding circular column<->table refs.
    expect(findFirst).toHaveBeenCalledTimes(2);
    for (const call of findFirst.mock.calls) {
      const [args] = call as [{ where: unknown }];
      const params = collectStringParams(args.where);
      expect(params).toContain("co-A");
      expect(params).toContain("send-B");
      // sanity: we never queried for co-B (the send's real owner)
      expect(params).not.toContain(SEND.dealDeskCompanyId);
    }
  });
});
