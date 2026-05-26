// DEAL DESK: Smoke test for PE table migration 0085.
// Verifies dd_* tables exist after migration, basic CRUD works, and the
// dd_targets uniqueness constraint prevents duplicate (dealDeskCompanyId,
// companyName) pairs.

import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { applyPendingMigrations } from "./client.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbedded = embeddedPostgresSupport.supported ? describe : describe.skip;

async function createTempDb(): Promise<string> {
  const db = await startEmbeddedPostgresTestDatabase("dealdesk-deal-desk-");
  cleanups.push(db.cleanup);
  return db.connectionString;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

const EXPECTED_DD_TABLES = [
  "dd_contacts",
  "dd_email_accounts",
  "dd_intermediaries",
  "dd_outreach_campaigns",
  "dd_outreach_sends",
  "dd_role_templates",
  "dd_suppression_list",
  "dd_targets",
  "dd_theses",
];

describeEmbedded("deal desk migration (0085)", () => {
  it(
    "creates all dd_* tables",
    async () => {
      const connectionString = await createTempDb();
      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const rows = await sql.unsafe<{ table_name: string }[]>(
          `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name LIKE 'dd_%'
            ORDER BY table_name
          `,
        );
        expect(rows.map((r) => r.table_name)).toEqual(EXPECTED_DD_TABLES);
      } finally {
        await sql.end();
      }
    },
    30_000,
  );

  it(
    "supports CRUD on dd_theses and dd_targets",
    async () => {
      const connectionString = await createTempDb();
      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const companyId = "00000000-0000-0000-0000-000000000001";

        const [thesis] = await sql.unsafe<{ id: string }[]>(
          `
            INSERT INTO dd_theses
              (deal_desk_company_id, name, sector)
            VALUES
              ('${companyId}', 'HVAC Southeast', 'HVAC Services')
            RETURNING id
          `,
        );
        expect(thesis?.id).toBeDefined();

        const [target] = await sql.unsafe<{ id: string; status: string }[]>(
          `
            INSERT INTO dd_targets
              (deal_desk_company_id, thesis_id, company_name, fit_score, fit_rationale)
            VALUES
              ('${companyId}', '${thesis!.id}', 'Acme HVAC', 75, 'Solid fit')
            RETURNING id, status
          `,
        );
        expect(target?.status).toBe("sourced");

        await sql.unsafe(
          `UPDATE dd_targets SET status = 'qualified' WHERE id = '${target!.id}'`,
        );
        const [updated] = await sql.unsafe<{ status: string }[]>(
          `SELECT status FROM dd_targets WHERE id = '${target!.id}'`,
        );
        expect(updated?.status).toBe("qualified");

        await sql.unsafe(`DELETE FROM dd_targets WHERE id = '${target!.id}'`);
        const remaining = await sql.unsafe<{ id: string }[]>(
          `SELECT id FROM dd_targets WHERE id = '${target!.id}'`,
        );
        expect(remaining).toHaveLength(0);
      } finally {
        await sql.end();
      }
    },
    30_000,
  );

  it(
    "enforces unique (deal_desk_company_id, company_name) on dd_targets",
    async () => {
      const connectionString = await createTempDb();
      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const companyId = "00000000-0000-0000-0000-000000000002";
        const [thesis] = await sql.unsafe<{ id: string }[]>(
          `
            INSERT INTO dd_theses (deal_desk_company_id, name, sector)
            VALUES ('${companyId}', 'Test', 'Test')
            RETURNING id
          `,
        );

        await sql.unsafe(
          `
            INSERT INTO dd_targets (deal_desk_company_id, thesis_id, company_name)
            VALUES ('${companyId}', '${thesis!.id}', 'Dup Co')
          `,
        );

        let dupError: unknown;
        try {
          await sql.unsafe(
            `
              INSERT INTO dd_targets (deal_desk_company_id, thesis_id, company_name)
              VALUES ('${companyId}', '${thesis!.id}', 'Dup Co')
            `,
          );
        } catch (err) {
          dupError = err;
        }
        expect(dupError).toBeDefined();
      } finally {
        await sql.end();
      }
    },
    30_000,
  );

  it(
    "leaves a representative set of DealDesk tables intact",
    async () => {
      const connectionString = await createTempDb();
      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const rows = await sql.unsafe<{ table_name: string }[]>(
          `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('companies', 'agents', 'issues', 'goals', 'projects')
            ORDER BY table_name
          `,
        );
        expect(rows.map((r) => r.table_name).sort()).toEqual([
          "agents",
          "companies",
          "goals",
          "issues",
          "projects",
        ]);
      } finally {
        await sql.end();
      }
    },
    30_000,
  );
});
