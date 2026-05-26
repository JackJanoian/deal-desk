import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  gmailClientConfigGetHandler,
  gmailClientConfigPostHandler,
  gmailClientConfigDeleteHandler,
} from "../gmail-client-config.js";

const baseDeps = {
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn(),
  deleteConfig: vi.fn(),
  resolveRedirectUri: () => "http://127.0.0.1:3100/api/oauth/gmail/callback",
};

describe("Gmail OAuth client config endpoints", () => {
  it("GET returns configured:false and the redirect URI when no credentials saved", async () => {
    const app = express();
    app.get("/c/:companyId/gmail-oauth-client", gmailClientConfigGetHandler(baseDeps as never));
    const res = await request(app).get("/c/co-1/gmail-oauth-client");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      configured: false,
      redirectUri: "http://127.0.0.1:3100/api/oauth/gmail/callback",
      redirectUriAlternates: ["http://localhost:3100/api/oauth/gmail/callback"],
    });
  });

  it("GET returns configured:true when credentials exist", async () => {
    const app = express();
    app.get(
      "/c/:companyId/gmail-oauth-client",
      gmailClientConfigGetHandler({
        ...baseDeps,
        loadConfig: vi.fn().mockResolvedValue({ clientId: "x", clientSecret: "y" }),
      } as never),
    );
    const res = await request(app).get("/c/co-1/gmail-oauth-client");
    expect(res.body.configured).toBe(true);
  });

  it("POST returns 400 when clientId is missing", async () => {
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/gmail-oauth-client", gmailClientConfigPostHandler(baseDeps as never));
    const res = await request(app)
      .post("/c/co-1/gmail-oauth-client")
      .send({ clientSecret: "GOCSPX-xxx" });
    expect(res.status).toBe(400);
  });

  it("POST saves both fields and returns ok", async () => {
    const saveConfig = vi.fn().mockResolvedValue(undefined);
    const app = express();
    app.use(express.json());
    app.post(
      "/c/:companyId/gmail-oauth-client",
      gmailClientConfigPostHandler({ ...baseDeps, saveConfig } as never),
    );
    const res = await request(app).post("/c/co-1/gmail-oauth-client").send({
      clientId: "abc.apps.googleusercontent.com",
      clientSecret: "GOCSPX-xxx",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(saveConfig).toHaveBeenCalledWith({
      companyId: "co-1",
      clientId: "abc.apps.googleusercontent.com",
      clientSecret: "GOCSPX-xxx",
    });
  });

  it("DELETE removes credentials and returns ok", async () => {
    const deleteConfig = vi.fn().mockResolvedValue(undefined);
    const app = express();
    app.delete(
      "/c/:companyId/gmail-oauth-client",
      gmailClientConfigDeleteHandler({ ...baseDeps, deleteConfig } as never),
    );
    const res = await request(app).delete("/c/co-1/gmail-oauth-client");
    expect(res.status).toBe(200);
    expect(deleteConfig).toHaveBeenCalledWith({ companyId: "co-1" });
  });
});
