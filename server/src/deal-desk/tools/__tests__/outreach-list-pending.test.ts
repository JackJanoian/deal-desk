import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { listPendingOutreachHandler } from "../outreach-list-pending.js";

describe("GET /outreach/sends/pending", () => {
  it("returns awaiting_approval sends with joined contact fields", async () => {
    const fakeDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: "s-1",
                dealDeskCompanyId: "co-1",
                campaignId: "camp-1",
                targetId: "tgt-1",
                contactId: "c-1",
                cadenceStep: 0,
                subject: "Hi",
                body: "Body",
                status: "awaiting_approval",
                draftedByAgentId: null,
                approvedByUserId: null,
                editedAt: null,
                editedByUserId: null,
                approvedAt: null,
                scheduledSendAt: null,
                sentAt: null,
                repliedAt: null,
                externalMessageId: null,
                createdAt: new Date("2026-01-01"),
                updatedAt: new Date("2026-01-01"),
                contactEmail: "bob@example.com",
                contactFirstName: "Bob",
                contactLastName: "Smith",
              },
            ]),
            }),
          }),
        }),
      }),
    };
    const app = express();
    app.get(
      "/c/:companyId/outreach/sends/pending",
      listPendingOutreachHandler(fakeDb as never),
    );
    const res = await request(app).get("/c/co-1/outreach/sends/pending");
    expect(res.status).toBe(200);
    expect(res.body.sends).toHaveLength(1);
    expect(res.body.sends[0]).toMatchObject({
      id: "s-1",
      subject: "Hi",
      body: "Body",
      status: "awaiting_approval",
      contactEmail: "bob@example.com",
      contactName: "Bob Smith",
    });
  });
});
