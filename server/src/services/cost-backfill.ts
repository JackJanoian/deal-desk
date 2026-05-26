import { and, asc, eq, isNotNull, notExists } from "drizzle-orm";
import type { Db } from "@dealdesk/db";
import { costEvents, heartbeatRuns, issues } from "@dealdesk/db";
import { parseObject } from "../adapters/utils.js";
import { costService } from "./costs.js";
import {
  normalizeLedgerBillingType,
  readCostUsdFromJson,
  readDurationMsFromResultJson,
  readNormalizedUsageTotalsFromJson,
  resolveLedgerCostCents,
} from "./cost-ledger.js";
import type { BudgetServiceHooks } from "./budgets.js";

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveLedgerScopeForRun(
  db: Db,
  companyId: string,
  run: typeof heartbeatRuns.$inferSelect,
) {
  const context = parseObject(run.contextSnapshot);
  const contextIssueId = readNonEmptyString(context.issueId);
  const contextProjectId = readNonEmptyString(context.projectId);

  if (!contextIssueId) {
    return {
      issueId: null,
      projectId: contextProjectId,
    };
  }

  const issue = await db
    .select({
      id: issues.id,
      projectId: issues.projectId,
    })
    .from(issues)
    .where(and(eq(issues.id, contextIssueId), eq(issues.companyId, companyId)))
    .then((rows) => rows[0] ?? null);

  return {
    issueId: issue?.id ?? null,
    projectId: issue?.projectId ?? contextProjectId,
  };
}

function readLedgerFieldsFromUsageJson(usageJson: unknown) {
  const parsed = parseObject(usageJson);
  return {
    provider: readNonEmptyString(parsed.provider) ?? "unknown",
    biller: readNonEmptyString(parsed.biller) ?? readNonEmptyString(parsed.provider) ?? "unknown",
    billingType: normalizeLedgerBillingType(parsed.billingType),
    model: readNonEmptyString(parsed.model) ?? "unknown",
    costUsd: readCostUsdFromJson(parsed),
    usage: readNormalizedUsageTotalsFromJson(parsed),
  };
}

export function costBackfillService(db: Db, budgetHooks: BudgetServiceHooks = {}) {
  const costs = costService(db, budgetHooks);

  return {
    backfillCompany: async (companyId: string, options: { dryRun?: boolean; limit?: number } = {}) => {
      const limit = options.limit ?? 5000;
      const runs = await db
        .select()
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
        )
        .orderBy(asc(heartbeatRuns.finishedAt))
        .limit(limit);

      let inserted = 0;
      let skipped = 0;
      let estimated = 0;

      for (const run of runs) {
        const ledgerFields = readLedgerFieldsFromUsageJson(run.usageJson);
        const durationMs = readDurationMsFromResultJson(run.resultJson);
        const resolved = resolveLedgerCostCents({
          billingType: ledgerFields.billingType,
          costUsd: ledgerFields.costUsd,
          provider: ledgerFields.provider,
          model: ledgerFields.model,
          usage: ledgerFields.usage,
          durationMs,
        });
        const usage = resolved.usage ?? ledgerFields.usage;
        const hasTokenUsage = Boolean(
          usage && (usage.inputTokens > 0 || usage.cachedInputTokens > 0 || usage.outputTokens > 0),
        );

        if (resolved.costCents <= 0 && !hasTokenUsage) {
          skipped += 1;
          continue;
        }

        if (resolved.estimated) estimated += 1;
        if (options.dryRun) {
          inserted += 1;
          continue;
        }

        const ledgerScope = await resolveLedgerScopeForRun(db, companyId, run);
        await costs.createEvent(companyId, {
          heartbeatRunId: run.id,
          agentId: run.agentId,
          issueId: ledgerScope.issueId,
          projectId: ledgerScope.projectId,
          provider: ledgerFields.provider,
          biller: ledgerFields.biller,
          billingType: ledgerFields.billingType,
          model: ledgerFields.model,
          inputTokens: usage?.inputTokens ?? 0,
          cachedInputTokens: usage?.cachedInputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          costCents: resolved.costCents,
          occurredAt: run.finishedAt ?? run.createdAt,
        });
        inserted += 1;
      }

      return {
        companyId,
        scanned: runs.length,
        inserted,
        skipped,
        estimated,
        dryRun: Boolean(options.dryRun),
      };
    },
  };
}
