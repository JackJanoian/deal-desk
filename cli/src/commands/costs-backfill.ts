import * as p from "@clack/prompts";
import pc from "picocolors";
import { createDb } from "@dealdesk/db";
import { costBackfillService } from "@dealdesk/server/cost-backfill";
import { readConfig, resolveConfigPath } from "../config/store.js";
import { printDealDeskCliBanner } from "../utils/banner.js";

type ClosableDb = ReturnType<typeof createDb> & {
  $client?: {
    end?: (options?: { timeout?: number }) => Promise<void>;
  };
};

async function closeDb(db: ClosableDb): Promise<void> {
  await db.$client?.end?.({ timeout: 5 }).catch(() => undefined);
}

function resolveConnectionString(configPath?: string): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) return envUrl;

  const config = readConfig(configPath);
  if (config?.database.mode === "postgres" && config.database.connectionString?.trim()) {
    return config.database.connectionString.trim();
  }

  const port = config?.database.embeddedPostgresPort ?? 54329;
  return `postgres://dealdesk:dealdesk@127.0.0.1:${port}/dealdesk`;
}

export async function costsBackfillCommand(opts: {
  config?: string;
  company?: string;
  dryRun?: boolean;
  limit?: number;
}): Promise<void> {
  printDealDeskCliBanner();
  p.intro(pc.bgCyan(pc.black(" dealdesk costs backfill ")));

  const companyId = opts.company?.trim();
  if (!companyId) {
    p.log.error("Missing required --company <companyId>");
    p.outro(pc.red("Backfill aborted."));
    return;
  }

  const configPath = resolveConfigPath(opts.config);
  const connectionString = resolveConnectionString(configPath);
  const db = createDb(connectionString) as ClosableDb;

  try {
    const spinner = p.spinner();
    spinner.start("Backfilling cost_events from heartbeat runs...");
    const result = await costBackfillService(db).backfillCompany(companyId, {
      dryRun: Boolean(opts.dryRun),
      limit: opts.limit,
    });
    spinner.stop(
      result.dryRun
        ? `Dry run complete: ${result.inserted} event(s) would be inserted (${result.skipped} skipped)`
        : `Inserted ${result.inserted} cost event(s) (${result.skipped} skipped, ${result.estimated} estimated)`,
    );
    p.note(
      [
        `Company: ${result.companyId}`,
        `Scanned: ${result.scanned}`,
        `Inserted: ${result.inserted}`,
        `Skipped: ${result.skipped}`,
        `Estimated: ${result.estimated}`,
        `Dry run: ${result.dryRun ? "yes" : "no"}`,
      ].join("\n"),
      "Backfill summary",
    );
    p.outro(pc.green("Cost backfill complete."));
  } finally {
    await closeDb(db);
  }
}
