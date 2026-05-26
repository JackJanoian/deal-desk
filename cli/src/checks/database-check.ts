import fs from "node:fs";
import path from "node:path";
import type { DealDeskConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";
import { resolveRuntimeLikePath } from "./path-resolver.js";

type ClosableDb = ReturnType<typeof import("@dealdesk/db").createDb> & {
  $client?: {
    end?: (options?: { timeout?: number }) => Promise<void>;
  };
};

async function closeDb(db: ClosableDb): Promise<void> {
  await db.$client?.end?.({ timeout: 5 }).catch(() => undefined);
}

export async function databaseCheck(config: DealDeskConfig, configPath?: string): Promise<CheckResult> {
  if (config.database.mode === "postgres") {
    if (!config.database.connectionString) {
      return {
        name: "Database",
        status: "fail",
        message: "PostgreSQL mode selected but no connection string configured",
        canRepair: false,
        repairHint: "Run `dealdesk configure --section database`",
      };
    }

    try {
      const { createDb } = await import("@dealdesk/db");
      const db = createDb(config.database.connectionString) as ClosableDb;
      try {
        await db.execute("SELECT 1");
      } finally {
        await closeDb(db);
      }
      return {
        name: "Database",
        status: "pass",
        message: "PostgreSQL connection successful",
      };
    } catch (err) {
      return {
        name: "Database",
        status: "fail",
        message: `Cannot connect to PostgreSQL: ${err instanceof Error ? err.message : String(err)}`,
        canRepair: false,
        repairHint: "Check your connection string and ensure PostgreSQL is running",
      };
    }
  }

  if (config.database.mode === "embedded-postgres") {
    const dataDir = resolveRuntimeLikePath(config.database.embeddedPostgresDataDir, configPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const port = config.database.embeddedPostgresPort;
    const connectionString = `postgres://dealdesk:dealdesk@127.0.0.1:${port}/dealdesk`;
    const adminConnectionString = `postgres://dealdesk:dealdesk@127.0.0.1:${port}/postgres`;
    try {
      const { createDb, getPostgresDataDirectory } = await import("@dealdesk/db");
      const db = createDb(connectionString) as ClosableDb;
      try {
        await db.execute("SELECT 1");
      } finally {
        await closeDb(db);
      }

      const actualDataDir = await getPostgresDataDirectory(adminConnectionString);
      if (actualDataDir && path.resolve(actualDataDir) !== path.resolve(dataDir)) {
        return {
          name: "Database",
          status: "fail",
          message: `Embedded PostgreSQL port ${port} is serving a different data directory (${actualDataDir}); expected ${dataDir}`,
          canRepair: false,
          repairHint: "Stop the other PostgreSQL process or choose a different embedded PostgreSQL port",
        };
      }

      return {
        name: "Database",
        status: "pass",
        message: `Embedded PostgreSQL is reachable at ${dataDir} (port ${port})`,
      };
    } catch (err) {
      return {
        name: "Database",
        status: "warn",
        message: `Embedded PostgreSQL configured at ${dataDir} (port ${port}) but not currently reachable: ${err instanceof Error ? err.message : String(err)}. The server will start it when running in embedded mode.`,
      };
    }
  }

  return {
    name: "Database",
    status: "fail",
    message: `Unknown database mode: ${String(config.database.mode)}`,
    canRepair: false,
    repairHint: "Run `dealdesk configure --section database`",
  };
}
