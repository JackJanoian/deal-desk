// DEAL DESK: Phase 5 tool handler tests against embedded Postgres
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  ddIntermediaries,
  ddTargets,
  ddTheses,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { dealDeskToolsRouter } from "../index.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported
  ? describe
  : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres deal desk tool tests on this host: ${
      embeddedPostgresSupport.reason ?? "unsupported environment"
    }`,
  );
}

describeEmbeddedPostgres("deal-desk tools", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null =
    null;
  let companyId!: string;
  let thesisId!: string;
  let app!: express.Express;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-deal-desk-tools-");
    db = createDb(tempDb.connectionString);
    app = express();
    app.use(express.json());
    app.use("/companies/:companyId/deal-desk/tools", dealDeskToolsRouter(db));
  }, 60_000);

  beforeEach(async () => {
    await db.delete(ddTargets);
    await db.delete(ddIntermediaries);
    await db.delete(ddTheses);
    companyId = randomUUID();
    const inserted = await db
      .insert(ddTheses)
      .values({
        paperclipCompanyId: companyId,
        name: "HVAC SE",
        sector: "HVAC Services",
      })
      .returning({ id: ddTheses.id });
    thesisId = inserted[0]!.id;
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  function makeTargetBody(overrides: Record<string, unknown> = {}) {
    return {
      thesisId,
      companyName: "Acme HVAC",
      website: "https://acmehvac.example.com",
      sector: "HVAC Services",
      hqCity: "Atlanta",
      hqState: "GA",
      fitScore: 75,
      fitRationale:
        "Atlanta-area commercial HVAC contractor. Roughly $10M revenue, founder-led.",
      sources: [
        { url: "https://acmehvac.example.com", description: "Company site" },
      ],
      ...overrides,
    };
  }

  it("createTarget: happy path returns action 'created'", async () => {
    const res = await request(app)
      .post(`/companies/${companyId}/deal-desk/tools/targets`)
      .send(makeTargetBody());
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.action).toBe("created");
    expect(typeof res.body.targetId).toBe("string");
  });

  it("createTarget: duplicate returns 'updated_existing' and appends rationale to notes", async () => {
    const first = await request(app)
      .post(`/companies/${companyId}/deal-desk/tools/targets`)
      .send(makeTargetBody());
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/companies/${companyId}/deal-desk/tools/targets`)
      .send(
        makeTargetBody({
          fitRationale:
            "Second pass — additional intel about ownership structure surfaced.",
        }),
      );
    expect(second.status).toBe(200);
    expect(second.body.action).toBe("updated_existing");
    expect(second.body.targetId).toBe(first.body.targetId);

    const row = await db.query.ddTargets.findFirst({});
    expect(row?.notes ?? "").toContain("Second pass");
    expect(row?.notes ?? "").toContain("Re-sourced");
  });

  it("createTarget: fitScore=30 returns ok=false without persisting", async () => {
    const res = await request(app)
      .post(`/companies/${companyId}/deal-desk/tools/targets`)
      .send(makeTargetBody({ fitScore: 30 }));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(String(res.body.reason)).toMatch(/below 40/);

    const count = await db.query.ddTargets.findMany({});
    expect(count.length).toBe(0);
  });

  it("listTargets: returns inserted target", async () => {
    await request(app)
      .post(`/companies/${companyId}/deal-desk/tools/targets`)
      .send(makeTargetBody());

    const res = await request(app)
      .get(`/companies/${companyId}/deal-desk/tools/targets`)
      .query({ thesisId });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.targets[0].name).toBe("Acme HVAC");
    expect(res.body.targets[0].fitScore).toBe(75);
  });

  it("recordIntermediaryTouch: updates lastTouchDate and recomputes nextTouchDue", async () => {
    const createRes = await request(app)
      .post(`/companies/${companyId}/deal-desk/tools/intermediaries`)
      .send({
        name: "Jane Banker",
        firm: "Acme Advisors",
        coverageSectors: ["HVAC Services"],
        recentDeals: [],
        cadenceDays: 30,
      });
    expect(createRes.status).toBe(201);
    const intermediaryId = createRes.body.intermediaryId as string;

    const touchRes = await request(app)
      .post(`/companies/${companyId}/deal-desk/tools/intermediaries/touch`)
      .send({
        intermediaryId,
        touchType: "email",
        notes: "Quarterly check-in sent.",
      });
    expect(touchRes.status).toBe(200);
    expect(touchRes.body.ok).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    expect(touchRes.body.intermediary.lastTouchDate).toBe(today);

    const expectedNext = new Date();
    expectedNext.setUTCDate(expectedNext.getUTCDate() + 30);
    expect(touchRes.body.intermediary.nextTouchDue).toBe(
      expectedNext.toISOString().slice(0, 10),
    );
  });
});
