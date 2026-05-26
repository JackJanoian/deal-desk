import { describe, it, expect } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import { createGmailOAuthRouter } from "../gmail-oauth.js";
import { forbidden } from "../../errors.js";

const allowAll = () => {};

describe("Gmail OAuth routes", () => {
  it("GET /start redirects to Google authorize URL when company has credentials", async () => {
    const app = express();
    app.use(
      createGmailOAuthRouter({
        loadClientConfig: async () => ({ clientId: "cid", clientSecret: "csec" }),
        resolveRedirectUri: () => "https://x.test/cb",
        resolveCompanyId: () => "co-1",
        authorizeCompanyId: allowAll,
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
        authorizeCompanyId: allowAll,
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
        authorizeCompanyId: allowAll,
        deps: { db: {} as never },
      }),
    );
    const res = await request(app).get("/start");
    expect(res.status).toBe(400);
  });

  it("GET /start redirects to Google when authorizeCompanyId allows the company (companyA)", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as Request & { actor?: unknown }).actor = {
        type: "board",
        userId: "u1",
        source: "session",
        companyIds: ["companyA"],
      };
      next();
    });
    app.use(
      "/oauth/gmail",
      createGmailOAuthRouter({
        loadClientConfig: async () => ({ clientId: "x", clientSecret: "y" }),
        resolveRedirectUri: () => "https://example.com/cb",
        resolveCompanyId: (req) => (req.query.companyId as string) ?? null,
        authorizeCompanyId: (_req, companyId) => {
          if (companyId !== "companyA") throw forbidden("no access");
        },
        deps: { db: null as never },
      }),
    );
    const res = await request(app).get("/oauth/gmail/start?companyId=companyA");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com/o/oauth2/v2/auth");
  });

  it("GET /start returns 403 when authorizeCompanyId rejects a foreign companyId (companyB)", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as Request & { actor?: unknown }).actor = {
        type: "board",
        userId: "u1",
        source: "session",
        companyIds: ["companyA"],
      };
      next();
    });
    app.use(
      "/oauth/gmail",
      createGmailOAuthRouter({
        loadClientConfig: async () => ({ clientId: "x", clientSecret: "y" }),
        resolveRedirectUri: () => "https://example.com/cb",
        resolveCompanyId: (req) => (req.query.companyId as string) ?? null,
        authorizeCompanyId: (_req, companyId) => {
          if (companyId !== "companyA") throw forbidden("no access");
        },
        deps: { db: null as never },
      }),
    );
    const res = await request(app).get("/oauth/gmail/start?companyId=companyB");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ ok: false });
  });
});
