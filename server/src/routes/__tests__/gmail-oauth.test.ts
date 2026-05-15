import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createGmailOAuthRouter } from "../gmail-oauth.js";

describe("Gmail OAuth routes", () => {
  it("GET /start redirects to Google authorize URL when company has credentials", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        loadClientConfig: async () => ({ clientId: "cid", clientSecret: "csec" }),
        resolveRedirectUri: () => "https://x.test/cb",
        resolveCompanyId: () => "co-1",
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start?companyId=co-1");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(res.headers.location).toContain("client_id=cid");
    expect(res.headers["set-cookie"]?.[0]).toContain("dd_gmail_oauth_state=");
  });

  it("GET /start returns 412 when company has no Gmail OAuth client configured", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        loadClientConfig: async () => null,
        resolveRedirectUri: () => "https://x.test/cb",
        resolveCompanyId: () => "co-1",
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start?companyId=co-1");
    expect(res.status).toBe(412);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("GET /start returns 400 when companyId can't be resolved", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        loadClientConfig: async () => null,
        resolveRedirectUri: () => "https://x.test/cb",
        resolveCompanyId: () => null,
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start");
    expect(res.status).toBe(400);
  });
});
