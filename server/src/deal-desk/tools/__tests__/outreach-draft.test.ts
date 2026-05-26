import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { outreachDraftHandler } from "../outreach-draft.js";

const ensureContactEmailFromApolloMock = vi.fn();
const loadContactForEnrichmentMock = vi.fn();

vi.mock("../../enrichment/resolve-contact-email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../enrichment/resolve-contact-email.js")>();
  return {
    ...actual,
    ensureContactEmailFromApollo: (...args: unknown[]) =>
      ensureContactEmailFromApolloMock(...args),
    loadContactForEnrichment: (...args: unknown[]) => loadContactForEnrichmentMock(...args),
  };
});

describe("POST /outreach/draft", () => {
  it("returns 400 when subject is missing", async () => {
    const app = express();
    app.use(express.json());
    app.post("/outreach/draft", outreachDraftHandler({ db: {} as never }));
    const res = await request(app).post("/outreach/draft").send({
      campaignId: "11111111-1111-1111-1111-111111111111",
      targetId: "22222222-2222-2222-2222-222222222222",
      contactId: "33333333-3333-3333-3333-333333333333",
      body: "hello",
    });
    expect(res.status).toBe(400);
  });

  it("inserts a row after Apollo enrichment succeeds", async () => {
    loadContactForEnrichmentMock.mockResolvedValueOnce({
      id: "contact-1",
      email: null,
      source: null,
      emailStatus: "unverified",
    });
    ensureContactEmailFromApolloMock.mockResolvedValueOnce({
      ok: true,
      email: "bob@example.com",
      emailStatus: "verified",
      enriched: true,
    });
    const inserted: unknown[] = [];
    const fakeDb = {
      query: {
        ddContacts: {
          findFirst: vi.fn().mockResolvedValue({ id: "contact-1", targetId: "22222222-2222-2222-2222-222222222222" }),
        },
      },
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
    app.post("/c/:companyId/outreach/draft", outreachDraftHandler({
      db: fakeDb as never,
      loadApolloKey: async () => "apollo-key",
    }));
    const res = await request(app)
      .post("/c/co-1/outreach/draft")
      .send({
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

  it("returns 422 when Apollo cannot find an email", async () => {
    loadContactForEnrichmentMock.mockResolvedValueOnce({
      id: "contact-1",
      email: null,
      source: null,
      emailStatus: "unverified",
    });
    ensureContactEmailFromApolloMock.mockResolvedValueOnce({
      ok: false,
      code: "no_email_found",
      reason: "No email found",
    });
    const fakeDb = {
      query: {
        ddContacts: {
          findFirst: vi.fn().mockResolvedValue({ id: "contact-1", targetId: "22222222-2222-2222-2222-222222222222" }),
        },
      },
      insert: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/outreach/draft", outreachDraftHandler({
      db: fakeDb as never,
      loadApolloKey: async () => "apollo-key",
    }));
    const res = await request(app)
      .post("/c/co-1/outreach/draft")
      .send({
        campaignId: "11111111-1111-1111-1111-111111111111",
        targetId: "22222222-2222-2222-2222-222222222222",
        contactId: "33333333-3333-3333-3333-333333333333",
        subject: "Hello",
        body: "Body text",
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("no_email_found");
  });
});
