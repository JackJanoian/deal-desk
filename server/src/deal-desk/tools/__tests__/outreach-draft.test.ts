import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { outreachDraftHandler } from "../outreach-draft.js";

describe("POST /outreach/draft", () => {
  it("returns 400 when subject is missing", async () => {
    const app = express();
    app.use(express.json());
    app.post("/outreach/draft", outreachDraftHandler({ insert: vi.fn() } as never));
    const res = await request(app).post("/outreach/draft").send({
      campaignId: "11111111-1111-1111-1111-111111111111",
      targetId: "22222222-2222-2222-2222-222222222222",
      contactId: "33333333-3333-3333-3333-333333333333",
      body: "hello",
    });
    expect(res.status).toBe(400);
  });

  it("inserts a row with status awaiting_approval and returns the id", async () => {
    const inserted: unknown[] = [];
    const fakeDb = {
      insert: () => ({
        values: (v: unknown) => ({
          returning: async () => {
            inserted.push(v);
            return [{ id: "send-1" }];
          },
        }),
      }),
    };
    const app = express();
    app.use(express.json());
    app.post("/outreach/draft", outreachDraftHandler(fakeDb as never));
    const res = await request(app).post("/outreach/draft").send({
      campaignId: "11111111-1111-1111-1111-111111111111",
      targetId: "22222222-2222-2222-2222-222222222222",
      contactId: "33333333-3333-3333-3333-333333333333",
      subject: "Hello",
      body: "Body text",
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "send-1" });
    expect(inserted[0]).toMatchObject({ status: "awaiting_approval", subject: "Hello" });
  });
});
