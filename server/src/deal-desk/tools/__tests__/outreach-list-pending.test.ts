import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { listPendingOutreachHandler } from "../outreach-list-pending.js";

describe("GET /outreach/sends/pending", () => {
  it("returns awaiting_approval sends for the company", async () => {
    const fakeDb = {
      query: {
        ddOutreachSends: {
          findMany: vi.fn().mockResolvedValue([
            { id: "s-1", subject: "Hi", body: "Body", status: "awaiting_approval" },
          ]),
        },
      },
    };
    const app = express();
    app.get(
      "/c/:companyId/outreach/sends/pending",
      listPendingOutreachHandler(fakeDb as never),
    );
    const res = await request(app).get("/c/co-1/outreach/sends/pending");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sends: [{ id: "s-1", subject: "Hi", body: "Body", status: "awaiting_approval" }],
    });
  });
});
