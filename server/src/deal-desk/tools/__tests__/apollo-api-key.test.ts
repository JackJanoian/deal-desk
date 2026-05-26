import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import {
  apolloApiKeyGetHandler,
  apolloApiKeyPostHandler,
  apolloApiKeyDeleteHandler,
} from "../apollo-api-key.js";
import type { ApolloConfigStore } from "../../enrichment/apollo-config.js";

function makeInMemoryStore(): ApolloConfigStore {
  const byKey = new Map<string, { id: string; value: string }>();
  let n = 0;
  return {
    async getByKey(_companyId, k) {
      const v = byKey.get(k);
      return v ? { id: v.id } : null;
    },
    async create(_companyId, args) {
      n += 1;
      const id = `s-${n}`;
      byKey.set(args.key, { id, value: args.value });
      return { id };
    },
    async replace(secretId, args) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) byKey.set(k, { ...v, value: args.value });
      }
    },
    async remove(secretId) {
      for (const [k, v] of byKey.entries()) {
        if (v.id === secretId) byKey.delete(k);
      }
    },
    async load(_companyId, secretId) {
      for (const v of byKey.values()) if (v.id === secretId) return v.value;
      return null;
    },
  };
}

function makeApp(store: ApolloConfigStore) {
  const app = express();
  app.use(express.json());
  app.get("/c/:companyId/apollo-api-key", apolloApiKeyGetHandler({ store }));
  app.post(
    "/c/:companyId/apollo-api-key",
    apolloApiKeyPostHandler({
      store,
      probeCapabilities: async () => ({
        matchEnabled: false,
        searchEnabled: true,
        enrichmentEnabled: true,
        planLimited: true,
        masterKeyRequired: false,
        lastValidatedAt: "2026-01-01T00:00:00.000Z",
      }),
    }),
  );
  app.delete("/c/:companyId/apollo-api-key", apolloApiKeyDeleteHandler({ store }));
  return app;
}

describe("apollo-api-key handlers", () => {
  let store: ApolloConfigStore;
  beforeEach(() => {
    store = makeInMemoryStore();
  });

  it("GET returns configured=false initially", async () => {
    const res = await request(makeApp(store)).get("/c/c1/apollo-api-key");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      configured: false,
      matchEnabled: null,
      searchEnabled: null,
      lastValidatedAt: null,
    });
  });

  it("POST saves the key and returns capabilities from probe", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/c/:companyId/apollo-api-key",
      apolloApiKeyPostHandler({
        store,
        probeCapabilities: async () => ({
          matchEnabled: true,
          searchEnabled: true,
          enrichmentEnabled: true,
          planLimited: false,
          masterKeyRequired: false,
          lastValidatedAt: "2026-01-01T00:00:00.000Z",
        }),
      }),
    );
    app.get("/c/:companyId/apollo-api-key", apolloApiKeyGetHandler({ store }));
    const post = await request(app)
      .post("/c/c1/apollo-api-key")
      .send({ apiKey: "key-12345678" });
    expect(post.status).toBe(200);
    expect(post.body.ok).toBe(true);
    expect(post.body.capabilities.matchEnabled).toBe(true);
    const get = await request(app).get("/c/c1/apollo-api-key");
    expect(get.body.configured).toBe(true);
    expect(get.body.matchEnabled).toBe(true);
  });

  it("POST saves the key, GET then shows configured=true", async () => {
    const app = makeApp(store);
    const post = await request(app)
      .post("/c/c1/apollo-api-key")
      .send({ apiKey: "key-12345678" });
    expect(post.status).toBe(200);
    expect(post.body.ok).toBe(true);
    const get = await request(app).get("/c/c1/apollo-api-key");
    expect(get.body.configured).toBe(true);
  });

  it("POST rejects short keys", async () => {
    const res = await request(makeApp(store))
      .post("/c/c1/apollo-api-key")
      .send({ apiKey: "x" });
    expect(res.status).toBe(400);
  });

  it("DELETE removes the key", async () => {
    const app = makeApp(store);
    await request(app).post("/c/c1/apollo-api-key").send({ apiKey: "key-12345678" });
    const del = await request(app).delete("/c/c1/apollo-api-key");
    expect(del.status).toBe(200);
    const get = await request(app).get("/c/c1/apollo-api-key");
    expect(get.body.configured).toBe(false);
  });
});
