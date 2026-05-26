import { describe, expect, it } from "vitest";
import {
  estimateMeteredCostCents,
  estimateMeteredCostUsd,
  estimateTokensFromDurationMs,
  lookupModelPricingRates,
} from "./model-pricing.js";

describe("model-pricing", () => {
  it("estimates metered cost from token counts", () => {
    const usd = estimateMeteredCostUsd({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      inputTokens: 1_000_000,
      cachedInputTokens: 0,
      outputTokens: 100_000,
    });
    expect(usd).toBeCloseTo(4.5, 3);
    expect(
      estimateMeteredCostCents({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        inputTokens: 1_000_000,
        cachedInputTokens: 0,
        outputTokens: 100_000,
      }),
    ).toBe(450);
  });

  it("returns conservative defaults for unknown models", () => {
    expect(lookupModelPricingRates("unknown", "totally-new-model").inputUsdPerMillion).toBeGreaterThan(0);
  });

  it("estimates tokens from duration", () => {
    expect(estimateTokensFromDurationMs(60_000)).toEqual({
      inputTokens: 2100,
      cachedInputTokens: 0,
      outputTokens: 900,
    });
  });
});
