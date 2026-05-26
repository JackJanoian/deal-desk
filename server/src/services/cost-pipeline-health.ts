import { and, eq, isNotNull, notExists, sql } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { agentRuntimeState, agents, costEvents, heartbeatRuns } from "@dealdesk/db";
import type { CostPipelineHealth } from "@dealdesk/shared";

export async function getCostPipelineHealth(db: Db, companyId: string): Promise<CostPipelineHealth> {
  const [succeededWithUsageRow] = await db
    .select({ total: sql<number>`count(*)::double precision` })
    .from(heartbeatRuns)
    .where(
      and(
        eq(heartbeatRuns.companyId, companyId),
        eq(heartbeatRuns.status, "succeeded"),
        isNotNull(heartbeatRuns.usageJson),
      ),
    );

  const [costEventsRow] = await db
    .select({ total: sql<number>`count(*)::double precision` })
    .from(costEvents)
    .where(eq(costEvents.companyId, companyId));

  const [runtimeTokensRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${agentRuntimeState.totalInputTokens} + ${agentRuntimeState.totalOutputTokens} + ${agentRuntimeState.totalCachedInputTokens}), 0)::double precision`,
    })
    .from(agentRuntimeState)
    .innerJoin(agents, eq(agents.id, agentRuntimeState.agentId))
    .where(eq(agents.companyId, companyId));

  const [unlinkedRunsRow] = await db
    .select({ total: sql<number>`count(*)::double precision` })
    .from(heartbeatRuns)
    .where(
      and(
        eq(heartbeatRuns.companyId, companyId),
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

  const [estimatedSpendRow] = await db
    .select({ total: sql<number>`count(*)::double precision` })
    .from(costEvents)
    .where(
      and(
        eq(costEvents.companyId, companyId),
        sql`${costEvents.costCents} > 0`,
        sql`exists (
          select 1 from ${heartbeatRuns}
          where ${heartbeatRuns.id} = ${costEvents.heartbeatRunId}
            and (${heartbeatRuns.usageJson} ->> 'costEstimated') = 'true'
        )`,
      ),
    );

  return {
    succeededRunsWithUsage: Number(succeededWithUsageRow?.total ?? 0),
    costEventCount: Number(costEventsRow?.total ?? 0),
    runtimeTokenTotal: Number(runtimeTokensRow?.total ?? 0),
    unrecordedRunCount: Number(unlinkedRunsRow?.total ?? 0),
    hasEstimatedSpend: Number(estimatedSpendRow?.total ?? 0) > 0,
  };
}
