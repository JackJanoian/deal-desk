import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("Better Auth handler middleware order", () => {
  it("handles Better Auth POSTs before express.json consumes the body stream", async () => {
    let authHandlerCalls = 0;
    const app = await createApp({} as any, {
      uiMode: "none",
      serverPort: 3100,
      storageService: {} as any,
      deploymentMode: "authenticated",
      deploymentExposure: "public",
      allowedHostnames: ["127.0.0.1", "localhost"],
      bindHost: "127.0.0.1",
      authReady: true,
      companyDeletionEnabled: false,
      betterAuthHandler: async (req, res) => {
        authHandlerCalls += 1;
        if ((req as express.Request & { body?: unknown }).body !== undefined) {
          res.status(500).json({ error: "body parser already consumed auth request" });
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        res.status(200).json({ rawBody: Buffer.concat(chunks).toString("utf8") });
      },
    });

    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "jane@example.com", password: "paperclip-password" });

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.rawBody)).toEqual({
      email: "jane@example.com",
      password: "paperclip-password",
    });
    expect(authHandlerCalls).toBe(1);
  });

  it("leaves Paperclip-managed auth routes on the authenticated app path", async () => {
    let authHandlerCalls = 0;
    const app = await createApp({} as any, {
      uiMode: "none",
      serverPort: 3100,
      storageService: {} as any,
      deploymentMode: "authenticated",
      deploymentExposure: "public",
      allowedHostnames: ["127.0.0.1", "localhost"],
      bindHost: "127.0.0.1",
      authReady: true,
      companyDeletionEnabled: false,
      betterAuthHandler: (_req, res) => {
        authHandlerCalls += 1;
        res.status(200).json({ handledByBetterAuth: true });
      },
    });

    const res = await request(app).get("/api/auth/get-session");

    expect(res.status).toBe(401);
    expect(authHandlerCalls).toBe(0);
  });
});
