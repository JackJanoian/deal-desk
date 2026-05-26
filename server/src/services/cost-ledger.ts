import type { BillingType } from "@dealdesk/shared";
import { estimateMeteredCostCents, estimateTokensFromDurationMs } from "@dealdesk/shared/model-pricing";

export type UsageTotals = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export function deriveNormalizedUsageDelta(current: UsageTotals | null, previous: UsageTotals | null): UsageTotals | null {
  if (!current) return null;
  if (!previous) return { ...current };

  const inputTokens = current.inputTokens >= previous.inputTokens
    ? current.inputTokens - previous.inputTokens
    : current.inputTokens;
  const cachedInputTokens = current.cachedInputTokens >= previous.cachedInputTokens
    ? current.cachedInputTokens - previous.cachedInputTokens
    : current.cachedInputTokens;
  const outputTokens = current.outputTokens >= previous.outputTokens
    ? current.outputTokens - previous.outputTokens
    : current.outputTokens;

  return {
    inputTokens: Math.max(0, inputTokens),
    cachedInputTokens: Math.max(0, cachedInputTokens),
    outputTokens: Math.max(0, outputTokens),
  };
}

export function deriveNormalizedCostDelta(currentCostUsd: number | null, previousCostUsd: number | null): number | null {
  if (currentCostUsd == null || !Number.isFinite(currentCostUsd)) return null;
  if (previousCostUsd == null || !Number.isFinite(previousCostUsd)) return currentCostUsd;
  if (currentCostUsd >= previousCostUsd) return currentCostUsd - previousCostUsd;
  return currentCostUsd;
}

export function normalizeLedgerBillingType(value: unknown): BillingType {
  const raw = typeof value === "string" ? value.trim() : "";
  switch (raw) {
    case "api":
    case "metered_api":
      return "metered_api";
    case "subscription":
    case "subscription_included":
      return "subscription_included";
    case "subscription_overage":
      return "subscription_overage";
    case "credits":
      return "credits";
    case "fixed":
      return "fixed";
    default:
      return "unknown";
  }
}

export function normalizeBilledCostCents(costUsd: number | null | undefined, billingType: BillingType): number {
  if (billingType === "subscription_included") return 0;
  if (typeof costUsd !== "number" || !Number.isFinite(costUsd)) return 0;
  return Math.max(0, Math.round(costUsd * 100));
}

export function readUsageTotalsFromJson(usageJson: unknown): UsageTotals | null {
  if (typeof usageJson !== "object" || usageJson === null || Array.isArray(usageJson)) return null;
  const parsed = usageJson as Record<string, unknown>;

  const inputTokens = Math.max(
    0,
    Math.floor(Number(parsed.rawInputTokens ?? parsed.inputTokens ?? 0) || 0),
  );
  const cachedInputTokens = Math.max(
    0,
    Math.floor(Number(parsed.rawCachedInputTokens ?? parsed.cachedInputTokens ?? 0) || 0),
  );
  const outputTokens = Math.max(
    0,
    Math.floor(Number(parsed.rawOutputTokens ?? parsed.outputTokens ?? 0) || 0),
  );

  if (inputTokens <= 0 && cachedInputTokens <= 0 && outputTokens <= 0) return null;
  return { inputTokens, cachedInputTokens, outputTokens };
}

export function readNormalizedUsageTotalsFromJson(usageJson: unknown): UsageTotals | null {
  if (typeof usageJson !== "object" || usageJson === null || Array.isArray(usageJson)) return null;
  const parsed = usageJson as Record<string, unknown>;

  const inputTokens = Math.max(0, Math.floor(Number(parsed.inputTokens ?? 0) || 0));
  const cachedInputTokens = Math.max(0, Math.floor(Number(parsed.cachedInputTokens ?? 0) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(parsed.outputTokens ?? 0) || 0));

  if (inputTokens <= 0 && cachedInputTokens <= 0 && outputTokens <= 0) return null;
  return { inputTokens, cachedInputTokens, outputTokens };
}

export function readCostUsdFromJson(usageJson: unknown): number | null {
  if (typeof usageJson !== "object" || usageJson === null || Array.isArray(usageJson)) return null;
  const parsed = usageJson as Record<string, unknown>;
  const raw = parsed.rawCostUsd ?? parsed.costUsd;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw;
}

export function readDurationMsFromResultJson(resultJson: unknown): number | null {
  if (typeof resultJson !== "object" || resultJson === null || Array.isArray(resultJson)) return null;
  const parsed = resultJson as Record<string, unknown>;
  const raw = parsed.durationMs;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

export function resolveLedgerCostCents(input: {
  billingType: BillingType;
  costUsd: number | null | undefined;
  provider: string;
  model: string;
  usage: UsageTotals | null;
  durationMs?: number | null;
  allowEstimation?: boolean;
}): { costCents: number; estimated: boolean; usage: UsageTotals | null } {
  const billingType = normalizeLedgerBillingType(input.billingType);
  let usage = input.usage;
  let costUsd = input.costUsd ?? null;
  let estimated = false;

  if (!usage && input.durationMs != null && input.allowEstimation !== false) {
    usage = estimateTokensFromDurationMs(input.durationMs);
    estimated = true;
  }

  let costCents = normalizeBilledCostCents(costUsd, billingType);
  const hasTokenUsage = Boolean(
    usage && (usage.inputTokens > 0 || usage.cachedInputTokens > 0 || usage.outputTokens > 0),
  );

  if (
    costCents <= 0 &&
    billingType === "metered_api" &&
    hasTokenUsage &&
    usage &&
    input.allowEstimation !== false
  ) {
    costCents = estimateMeteredCostCents({
      provider: input.provider,
      model: input.model,
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
    });
    estimated = true;
  }

  if (
    costCents <= 0 &&
    billingType === "metered_api" &&
    !hasTokenUsage &&
    input.durationMs != null &&
    input.durationMs > 0 &&
    input.allowEstimation !== false
  ) {
    usage = estimateTokensFromDurationMs(input.durationMs);
    costCents = estimateMeteredCostCents({
      provider: input.provider,
      model: input.model,
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
    });
    estimated = true;
  }

  return { costCents, estimated, usage };
}
