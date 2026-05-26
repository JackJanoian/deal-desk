import { describe, expect, it } from "vitest";
import { resolveLedgerCostCents } from "./cost-ledger.js";

describe("resolveLedgerCostCents", () => {
  it("preserves reported metered cost", () => {
    const result = resolveLedgerCostCents({
      billingType: "metered_api",
      costUsd: 0.12,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 200 },
    });
    expect(result.costCents).toBe(12);
    expect(result.estimated).toBe(false);
  });

  it("estimates cost when metered tokens exist without dollars", () => {
    const result = resolveLedgerCostCents({
      billingType: "metered_api",
      costUsd: null,
      provider: "openai",
      model: "gpt-4o",
      usage: { inputTokens: 100_000, cachedInputTokens: 0, outputTokens: 10_000 },
    });
    expect(result.costCents).toBeGreaterThan(0);
    expect(result.estimated).toBe(true);
  });

  it("keeps subscription-included spend at zero", () => {
    const result = resolveLedgerCostCents({
      billingType: "subscription_included",
      costUsd: 0.5,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      usage: { inputTokens: 5000, cachedInputTokens: 0, outputTokens: 1000 },
    });
    expect(result.costCents).toBe(0);
  });

  it("estimates usage and cost from duration for cursor-like runs", () => {
    const result = resolveLedgerCostCents({
      billingType: "metered_api",
      costUsd: null,
      provider: "cursor",
      model: "unknown",
      usage: null,
      durationMs: 120_000,
    });
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
    expect(result.costCents).toBeGreaterThan(0);
    expect(result.estimated).toBe(true);
  });
});
