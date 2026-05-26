import { and, count, eq, isNotNull, notExists, sql } from "drizzle-orm";
import { agentRuntimeState, costEvents, heartbeatRuns } from "@dealdesk/db";
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

async function resolveConnectionString(config: DealDeskConfig, configPath?: string): Promise<string | null> {
  if (config.database.mode === "postgres") {
    return config.database.connectionString ?? null;
  }
  if (config.database.mode === "embedded-postgres") {
    const port = config.database.embeddedPostgresPort;
    resolveRuntimeLikePath(config.database.embeddedPostgresDataDir, configPath);
    return `postgres://dealdesk:dealdesk@127.0.0.1:${port}/dealdesk`;
  }
  return null;
}

export async function costPipelineCheck(config: DealDeskConfig, configPath?: string): Promise<CheckResult> {
  const connectionString = await resolveConnectionString(config, configPath);
  if (!connectionString) {
    return {
      name: "Cost pipeline",
      status: "warn",
      message: "Cannot inspect cost pipeline without a PostgreSQL connection",
      repairHint: "Configure PostgreSQL or embedded-postgres, then re-run doctor",
    };
  }

  try {
    const { createDb } = await import("@dealdesk/db");
    const db = createDb(connectionString) as ClosableDb;
    try {
      const [succeededWithUsageRow] = await db
        .select({ total: count() })
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.status, "succeeded"), isNotNull(heartbeatRuns.usageJson)));

      const [costEventsRow] = await db.select({ total: count() }).from(costEvents);

      const [runtimeTokensRow] = await db
        .select({
          total: sql<number>`coalesce(sum(${agentRuntimeState.totalInputTokens} + ${agentRuntimeState.totalOutputTokens} + ${agentRuntimeState.totalCachedInputTokens}), 0)::double precision`,
        })
        .from(agentRuntimeState);

      const [unlinkedRunsRow] = await db
        .select({ total: count() })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.status, "succeeded"),
            isNotNull(heartbeatRuns.usageJson),
            notExists(
              db
                .select({ id: costEvents.id })
                .from(costEvents)
                .where(eq(costEvents.heartbeatRunId, heartbeatRuns.id)),
            ),
          ),
        );

      const succeededWithUsage = Number(succeededWithUsageRow?.total ?? 0);
      const costEventCount = Number(costEventsRow?.total ?? 0);
      const runtimeTokens = Number(runtimeTokensRow?.total ?? 0);
      const unlinkedRuns = Number(unlinkedRunsRow?.total ?? 0);

      if (succeededWithUsage === 0 && costEventCount === 0 && runtimeTokens === 0) {
        return {
          name: "Cost pipeline",
          status: "pass",
          message: "No agent usage recorded yet (Costs page will populate after heartbeats with LLM usage)",
        };
      }

      if (costEventCount === 0 && (succeededWithUsage > 0 || runtimeTokens > 0)) {
        return {
          name: "Cost pipeline",
          status: "warn",
          message: `${succeededWithUsage} succeeded run(s) with usage_json but 0 cost_events — Costs page will show $0`,
          repairHint: "Run `dealdesk costs backfill` to backfill ledger rows, then verify adapter billing metadata",
        };
      }

      if (unlinkedRuns > 0) {
        return {
          name: "Cost pipeline",
          status: "warn",
          message: `${costEventCount} cost event(s), but ${unlinkedRuns} succeeded run(s) with usage_json lack ledger rows`,
          repairHint: "Run `dealdesk costs backfill` to reconcile missing cost_events",
        };
      }

      return {
        name: "Cost pipeline",
        status: "pass",
        message: `${costEventCount} cost event(s); ${succeededWithUsage} succeeded run(s) with usage; ${runtimeTokens.toLocaleString()} runtime tokens tracked`,
      };
    } finally {
      await closeDb(db);
    }
  } catch (err) {
    return {
      name: "Cost pipeline",
      status: "warn",
      message: `Could not inspect cost pipeline: ${err instanceof Error ? err.message : String(err)}`,
      repairHint: "Ensure the database is reachable, then re-run doctor",
    };
  }
}
