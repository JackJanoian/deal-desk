import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { outreachApproveHandler } from "../outreach-approve.js";

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
    app.post("/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      loadClientConfig: async () => null,
    }));
    const res = await request(app).post("/outreach/sends/s-1/approve");
    expect(res.status).toBe(412);
  });
});
