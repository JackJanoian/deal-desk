export type ModelPricingRates = {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const DEFAULT_RATES: ModelPricingRates = {
  inputUsdPerMillion: 3,
  cachedInputUsdPerMillion: 0.3,
  outputUsdPerMillion: 15,
};

const MODEL_RATES: Record<string, ModelPricingRates> = {
  "claude-sonnet-4-20250514": { inputUsdPerMillion: 3, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 15 },
  "claude-sonnet-4-6": { inputUsdPerMillion: 3, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 15 },
  "claude-opus-4-20250514": { inputUsdPerMillion: 15, cachedInputUsdPerMillion: 1.5, outputUsdPerMillion: 75 },
  "claude-opus-4-6": { inputUsdPerMillion: 15, cachedInputUsdPerMillion: 1.5, outputUsdPerMillion: 75 },
  "claude-haiku-4-20250414": { inputUsdPerMillion: 0.8, cachedInputUsdPerMillion: 0.08, outputUsdPerMillion: 4 },
  "gpt-4o": { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 1.25, outputUsdPerMillion: 10 },
  "gpt-4o-mini": { inputUsdPerMillion: 0.15, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 0.6 },
  "gpt-4.1": { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 8 },
  "gpt-4.1-mini": { inputUsdPerMillion: 0.4, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 1.6 },
  "o3": { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 8 },
  "o4-mini": { inputUsdPerMillion: 1.1, cachedInputUsdPerMillion: 0.275, outputUsdPerMillion: 4.4 },
  "gemini-2.5-pro": { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.31, outputUsdPerMillion: 10 },
  "gemini-2.5-flash": { inputUsdPerMillion: 0.3, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 2.5 },
  "cursor-small": { inputUsdPerMillion: 1.5, cachedInputUsdPerMillion: 0.375, outputUsdPerMillion: 6 },
  "default": DEFAULT_RATES,
};

function normalizeModelKey(model: string): string {
  return model.trim().toLowerCase();
}

export function lookupModelPricingRates(_provider: string, model: string): ModelPricingRates {
  const key = normalizeModelKey(model);
  if (MODEL_RATES[key]) return MODEL_RATES[key]!;

  for (const [pattern, rates] of Object.entries(MODEL_RATES)) {
    if (pattern === "default") continue;
    if (key.includes(pattern) || pattern.includes(key)) return rates;
  }

  if (key.includes("opus")) {
    return MODEL_RATES["claude-opus-4-6"]!;
  }
  if (key.includes("haiku")) {
    return MODEL_RATES["claude-haiku-4-20250414"]!;
  }
  if (key.includes("sonnet")) {
    return MODEL_RATES["claude-sonnet-4-20250514"]!;
  }
  if (key.includes("mini")) {
    return MODEL_RATES["gpt-4o-mini"]!;
  }

  return DEFAULT_RATES;
}

export function estimateMeteredCostUsd(input: {
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}): number {
  const rates = lookupModelPricingRates(input.provider, input.model);
  const billableInput = Math.max(0, input.inputTokens - input.cachedInputTokens);
  const usd =
    (billableInput / 1_000_000) * rates.inputUsdPerMillion +
    (input.cachedInputTokens / 1_000_000) * rates.cachedInputUsdPerMillion +
    (input.outputTokens / 1_000_000) * rates.outputUsdPerMillion;
  return Math.max(0, usd);
}

export function estimateMeteredCostCents(input: {
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}): number {
  return Math.max(0, Math.round(estimateMeteredCostUsd(input) * 100));
}

/** Conservative token estimate when an adapter only reports wall-clock duration. */
export function estimateTokensFromDurationMs(durationMs: number): {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
} {
  const seconds = Math.max(1, durationMs / 1000);
  const totalTokens = Math.max(1000, Math.round(seconds * 50));
  const inputTokens = Math.round(totalTokens * 0.7);
  const outputTokens = totalTokens - inputTokens;
  return {
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
  };
}
