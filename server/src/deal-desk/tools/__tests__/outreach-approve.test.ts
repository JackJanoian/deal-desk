import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { outreachApproveHandler } from "../outreach-approve.js";

describe("POST /outreach/sends/:id/approve", () => {
  it("loads the send, fetches connected Gmail account, sends, updates row", async () => {
    const fakeDb = {
      query: {
        ddOutreachSends: { findFirst: vi.fn().mockResolvedValue({
          id: "send-1",
          paperclipCompanyId: "co-1",
          subject: "Hello",
          body: "Hi",
          contactId: "c-1",
          status: "awaiting_approval",
        })},
        ddContacts: { findFirst: vi.fn().mockResolvedValue({ email: "bob@example.com" }) },
        ddEmailAccounts: { findFirst: vi.fn().mockResolvedValue({
          id: "acc-1", emailAddress: "alice@example.com", secretId: "sec-1",
        })},
      },
      update: () => ({ set: (v: unknown) => ({ where: async () => v }) }),
    };
    const fakeSendGmail = vi.fn().mockResolvedValue({ messageId: "g-1", threadId: "t-1" });
    const fakeLoadTokens = vi.fn().mockResolvedValue({
      accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 600_000, scope: "x",
    });
    const fakeEnsureFresh = vi.fn().mockImplementation(async (i) => i.tokens);

    const app = express();
    app.use((req, _res, next) => { (req as never as { user: unknown }).user = { id: "u-1" }; next(); });
    app.post("/outreach/sends/:id/approve", outreachApproveHandler({
      db: fakeDb as never,
      googleOAuth: { clientId: "c", clientSecret: "s", redirectUri: "r" },
      sendGmail: fakeSendGmail,
      loadGmailTokens: fakeLoadTokens,
      ensureFreshAccessToken: fakeEnsureFresh,
    }));
    const res = await request(app).post("/outreach/sends/send-1/approve");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ messageId: "g-1" });
    expect(fakeSendGmail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "alice@example.com", to: "bob@example.com", subject: "Hello", body: "Hi" }),
      expect.anything(),
    );
  });

  it("returns 503 when googleOAuth is null", async () => {
    const app = express();
    app.post("/outreach/sends/:id/approve", outreachApproveHandler({
      db: {} as never,
      googleOAuth: null,
    }));
    const res = await request(app).post("/outreach/sends/x/approve");
    expect(res.status).toBe(503);
  });
});
