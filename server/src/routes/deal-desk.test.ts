// DEAL DESK: Phase 6 v0.2 — integration tests for the deal-desk routes.
//
// Uses the embedded Postgres test harness shared with other route tests
// (see invite-list-route.test.ts for the pattern). The router is mounted
// under /api/companies to mirror app.ts.

import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { companies, createDb, ddTargets, ddTheses } from "@dealdesk/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "../__tests__/helpers/embedded-postgres.js";

import { dealDeskRoutes } from "./deal-desk.js";
import { errorHandler } from "../middleware/index.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported
  ? describe
  : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres deal-desk route tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres(
  "PATCH /companies/:companyId/deal-desk/theses/:thesisId",
  () => {
    let db!: ReturnType<typeof createDb>;
    let tempDb: Awaited<
      ReturnType<typeof startEmbeddedPostgresTestDatabase>
    > | null = null;
    let companyId!: string;
    let otherCompanyId!: string;

    beforeAll(async () => {
      tempDb = await startEmbeddedPostgresTestDatabase(
        "dealdesk-deal-desk-routes-",
      );
      db = createDb(tempDb.connectionString);
    }, 30_000);

    beforeEach(async () => {
      companyId = randomUUID();
      otherCompanyId = randomUUID();
      await db.insert(companies).values([
        {
          id: companyId,
          name: "Owner Co",
          issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
          requireBoardApprovalForNewAgents: false,
        },
        {
          id: otherCompanyId,
          name: "Other Co",
          issuePrefix: `T${otherCompanyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
          requireBoardApprovalForNewAgents: false,
        },
      ]);
    });

    afterEach(async () => {
      await db.delete(ddTheses);
      await db.delete(companies);
    });

    afterAll(async () => {
      await tempDb?.cleanup();
    });

    function createApp(currentCompanyId: string) {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as { actor: unknown }).actor = {
          type: "board",
          source: "session",
          userId: "test-user",
          isInstanceAdmin: false,
          companyIds: [currentCompanyId],
          memberships: [
            {
              companyId: currentCompanyId,
              status: "active",
              membershipRole: "admin",
            },
          ],
        };
        next();
      });
      app.use("/api/companies", dealDeskRoutes(db));
      app.use(errorHandler);
      return app;
    }

    it("updates editable thesis fields and returns the new row", async () => {
      const [thesis] = await db
        .insert(ddTheses)
        .values({
          dealDeskCompanyId: companyId,
          name: "Original",
          sector: "Original sector",
        })
        .returning();

      const app = createApp(companyId);
      const res = await request(app)
        .patch(`/api/companies/${companyId}/deal-desk/theses/${thesis!.id}`)
        .send({
          name: "Updated",
          sector: "Updated sector",
          narrative: "Why",
          geos: ["FL", "GA"],
        })
        .expect(200);

      expect(res.body.name).toBe("Updated");
      expect(res.body.sector).toBe("Updated sector");
      expect(res.body.narrative).toBe("Why");
      expect(res.body.geos).toEqual(["FL", "GA"]);
    });

    it("rejects updates to companies the actor does not own", async () => {
      const [thesis] = await db
        .insert(ddTheses)
        .values({
          dealDeskCompanyId: companyId,
          name: "T",
          sector: "S",
        })
        .returning();

      const app = createApp(otherCompanyId);
      await request(app)
        .patch(`/api/companies/${companyId}/deal-desk/theses/${thesis!.id}`)
        .send({ name: "Hijack" })
        .expect(403);
    });

    it("returns 404 when the thesis does not exist", async () => {
      const app = createApp(companyId);
      await request(app)
        .patch(`/api/companies/${companyId}/deal-desk/theses/${randomUUID()}`)
        .send({ name: "Nope" })
        .expect(404);
    });

    // DEAL DESK: v0.3 — attachments persist as jsonb array on dd_theses
    it("persists thesis attachments", async () => {
      const [thesis] = await db
        .insert(ddTheses)
        .values({
          dealDeskCompanyId: companyId,
          name: "T",
          sector: "S",
        })
        .returning();

      const attachments = [
        {
          name: "memo.md",
          mime: "text/markdown",
          sizeBytes: 13,
          content: "# Hello world",
        },
      ];

      const app = createApp(companyId);
      const res = await request(app)
        .patch(`/api/companies/${companyId}/deal-desk/theses/${thesis!.id}`)
        .send({ attachments })
        .expect(200);

      expect(res.body.attachments).toEqual(attachments);
    });

    it("rejects too many attachments", async () => {
      const [thesis] = await db
        .insert(ddTheses)
        .values({
          dealDeskCompanyId: companyId,
          name: "T",
          sector: "S",
        })
        .returning();

      const tooMany = Array.from({ length: 6 }, (_, i) => ({
        name: `f${i}.md`,
        mime: "text/markdown",
        sizeBytes: 1,
        content: "x",
      }));

      const app = createApp(companyId);
      await request(app)
        .patch(`/api/companies/${companyId}/deal-desk/theses/${thesis!.id}`)
        .send({ attachments: tooMany })
        .expect(400);
    });
  },
);

describeEmbeddedPostgres("Deal Desk target routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<
    ReturnType<typeof startEmbeddedPostgresTestDatabase>
  > | null = null;
  let companyId!: string;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase(
      "dealdesk-deal-desk-targets-",
    );
    db = createDb(tempDb.connectionString);
  }, 30_000);

  beforeEach(async () => {
    companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Target Co",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
  });

  afterEach(async () => {
    await db.delete(ddTargets);
    await db.delete(ddTheses);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  function createApp(currentCompanyId: string) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { actor: unknown }).actor = {
        type: "board",
        source: "session",
        userId: "test-user",
        isInstanceAdmin: false,
        companyIds: [currentCompanyId],
        memberships: [
          {
            companyId: currentCompanyId,
            status: "active",
            membershipRole: "admin",
          },
        ],
      };
      next();
    });
    app.use("/api/companies", dealDeskRoutes(db));
    app.use(errorHandler);
    return app;
  }

  async function seedThesis() {
    const [thesis] = await db
      .insert(ddTheses)
      .values({
        dealDeskCompanyId: companyId,
        name: "HVAC SE",
        sector: "HVAC",
      })
      .returning();
    return thesis!;
  }

  function makeTargetBody(thesisId: string) {
    return {
      thesisId,
      companyName: "Acme HVAC",
      fitScore: 72,
      fitRationale: "Strong thesis fit with recurring revenue profile.",
      sources: [{ url: "https://acme.example.com", description: "Site" }],
    };
  }

  it("POST /deal-desk/targets creates a target", async () => {
    const thesis = await seedThesis();
    const app = createApp(companyId);
    const res = await request(app)
      .post(`/api/companies/${companyId}/deal-desk/targets`)
      .send(makeTargetBody(thesis.id))
      .expect(201);

    expect(res.body.companyName).toBe("Acme HVAC");
    expect(res.body.status).toBe("sourced");
  });

  it("GET /deal-desk/targets/:targetId returns a single target", async () => {
    const thesis = await seedThesis();
    const app = createApp(companyId);
    const created = await request(app)
      .post(`/api/companies/${companyId}/deal-desk/targets`)
      .send(makeTargetBody(thesis.id));

    const res = await request(app)
      .get(`/api/companies/${companyId}/deal-desk/targets/${created.body.id}`)
      .expect(200);

    expect(res.body.id).toBe(created.body.id);
  });

  it("PATCH /deal-desk/targets/:targetId updates status and notes", async () => {
    const thesis = await seedThesis();
    const app = createApp(companyId);
    const created = await request(app)
      .post(`/api/companies/${companyId}/deal-desk/targets`)
      .send(makeTargetBody(thesis.id));

    const res = await request(app)
      .patch(`/api/companies/${companyId}/deal-desk/targets/${created.body.id}`)
      .send({ status: "qualified", notes: "Partner review scheduled" })
      .expect(200);

    expect(res.body.status).toBe("qualified");
    expect(res.body.notes).toBe("Partner review scheduled");
    expect(res.body.statusChangedAt).toBeTruthy();
  });

  it("GET /deal-desk/pipeline/summary returns counts by status", async () => {
    const thesis = await seedThesis();
    const app = createApp(companyId);
    await request(app)
      .post(`/api/companies/${companyId}/deal-desk/targets`)
      .send(makeTargetBody(thesis.id));

    const res = await request(app)
      .get(`/api/companies/${companyId}/deal-desk/pipeline/summary`)
      .query({ thesisId: thesis.id })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.byStatus.sourced).toBe(1);
    expect(res.body.byStatus.qualified).toBe(0);
  });
});
