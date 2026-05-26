import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createContactHandler } from "../create-contact.js";

describe("POST /contacts", () => {
  it("creates a contact for a valid target", async () => {
    const fakeDb = {
      query: {
        ddTargets: {
          findFirst: vi.fn().mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", dealDeskCompanyId: "co-1" }),
        },
        ddContacts: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: () => ({
        values: (v: unknown) => ({
          returning: async () => {
            expect(v).toMatchObject({
              dealDeskCompanyId: "co-1",
              targetId: "11111111-1111-4111-8111-111111111111",
              firstName: "Alice",
              lastName: "Smith",
              isPrimary: true,
            });
            return [{ id: "contact-1" }];
          },
        }),
      }),
    };
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/contacts", createContactHandler(fakeDb as never));
    const res = await request(app)
      .post("/c/co-1/contacts")
      .send({
        targetId: "11111111-1111-4111-8111-111111111111",
        firstName: "Alice",
        lastName: "Smith",
        isPrimary: true,
      });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ contactId: "contact-1", existing: false });
  });

  it("returns existing primary contact instead of creating duplicate", async () => {
    const fakeDb = {
      query: {
        ddTargets: {
          findFirst: vi.fn().mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", dealDeskCompanyId: "co-1" }),
        },
        ddContacts: {
          findFirst: vi.fn().mockResolvedValue({ id: "existing-1", isPrimary: true }),
        },
      },
      insert: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    app.post("/c/:companyId/contacts", createContactHandler(fakeDb as never));
    const res = await request(app)
      .post("/c/co-1/contacts")
      .send({
        targetId: "11111111-1111-4111-8111-111111111111",
        firstName: "Alice",
        lastName: "Smith",
        isPrimary: true,
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ contactId: "existing-1", existing: true });
    expect(fakeDb.insert).not.toHaveBeenCalled();
  });
});
