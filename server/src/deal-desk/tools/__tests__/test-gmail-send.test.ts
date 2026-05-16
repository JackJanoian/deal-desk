import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { testGmailSendHandler } from "../test-gmail-send.js";

const baseTokens = {
  accessToken: "at",
  refreshToken: "rt",
  expiresAt: Date.now() + 600_000,
  scope: "x",
};

const happyDeps = () => ({
  db: {
    query: {
      ddEmailAccounts: {
        findFirst: vi.fn().mockResolvedValue({
          id: "acc-1",
          paperclipCompanyId: "co-1",
          emailAddress: "alice@example.com",
          secretId: "sec-tokens",
          revokedAt: null,
        }),
      },
    },
  },
  loadClientConfig: vi.fn().mockResolvedValue({ clientId: "cid", clientSecret: "csec" }),
  loadTokens: vi.fn().mockResolvedValue(baseTokens),
  ensureFreshAccessToken: vi.fn().mockImplementation(async (i) => i.tokens),
  sendGmail: vi.fn().mockResolvedValue({ messageId: "g-1", threadId: "t-1" }),
});

describe("POST /test-gmail-send", () => {
  it("returns 400 when 'to' is missing", async () => {
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/test-gmail-send", testGmailSendHandler(happyDeps() as never));
    const res = await request(app).post("/c/co-1/test-gmail-send").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when 'to' is not a valid email", async () => {
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/test-gmail-send", testGmailSendHandler(happyDeps() as never));
    const res = await request(app).post("/c/co-1/test-gmail-send").send({ to: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 412 when company has no connected Gmail account", async () => {
    const deps = happyDeps();
    deps.db.query.ddEmailAccounts.findFirst = vi.fn().mockResolvedValue(null);
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/test-gmail-send", testGmailSendHandler(deps as never));
    const res = await request(app).post("/c/co-1/test-gmail-send").send({ to: "x@y.com" });
    expect(res.status).toBe(412);
    expect(res.body.reason).toMatch(/no connected gmail account/i);
  });

  it("returns 412 when company has no OAuth client config", async () => {
    const deps = happyDeps();
    deps.loadClientConfig = vi.fn().mockResolvedValue(null);
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/test-gmail-send", testGmailSendHandler(deps as never));
    const res = await request(app).post("/c/co-1/test-gmail-send").send({ to: "x@y.com" });
    expect(res.status).toBe(412);
    expect(res.body.reason).toMatch(/oauth client not configured/i);
  });

  it("on success: loads tokens, refreshes, sends, returns {ok, from, to, messageId, threadId}", async () => {
    const deps = happyDeps();
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/test-gmail-send", testGmailSendHandler(deps as never));
    const res = await request(app)
      .post("/c/co-1/test-gmail-send")
      .send({ to: "bob@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      from: "alice@example.com",
      to: "bob@example.com",
      messageId: "g-1",
      threadId: "t-1",
    });
    expect(deps.sendGmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "alice@example.com",
        to: "bob@example.com",
        accessToken: "at",
      }),
      expect.anything(),
    );
  });

  it("uses default subject and body when not provided", async () => {
    const deps = happyDeps();
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/test-gmail-send", testGmailSendHandler(deps as never));
    await request(app).post("/c/co-1/test-gmail-send").send({ to: "bob@example.com" });
    const call = (deps.sendGmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.subject).toBe("Deal Desk smoke test");
    expect(call.body).toContain("smoke test");
  });
});
